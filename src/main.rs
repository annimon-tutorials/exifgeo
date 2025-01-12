use exif::{DateTime, In, Tag, Value};
use serde::Serialize;
use std::fs::File;
use std::io::{BufReader, Write};
use std::path::PathBuf;
use std::process::ExitCode;
use std::{env, fs};
use walkdir::WalkDir;

#[cfg_attr(any(), rustfmt::skip)]
const SUPPORTED_EXTENSIONS: [&str; 19] = [
    // Common
    "jpg", "jpeg", "png", "webp", "heic", "avif",
    // Raw
    "tif", "tiff", "dng", "raw",
    // Camera specific
    "arw", "orf", "sr2", "crw", "cr2", "cr3", "nef", "srw", "rw2"
];
const UNKNOWN: &str = "Unknown";

static MAP_HTML: &[u8] = include_bytes!("map.html");

#[derive(Serialize)]
struct PhotoInfo {
    name: String,
    path: String,
    thumb: String,
    lat: f32,
    lon: f32,
    make: String,
    model: String,
    date: String,
}

fn main() -> ExitCode {
    let dir = env::args_os()
        .nth(1)
        .map(PathBuf::from)
        .filter(|path| path.is_dir());
    if dir.is_none() {
        eprintln!("Usage: exifgeo <directory>");
        return ExitCode::FAILURE;
    }

    let thumbs_dir = "thumbs";
    if let Err(e) = fs::create_dir_all(thumbs_dir) {
        eprintln!("Could not create {} directory: {}", thumbs_dir, e);
        return ExitCode::FAILURE;
    }

    let input_dir = dir.unwrap();
    println!(
        "Scanning directory: {}",
        input_dir.as_os_str().to_string_lossy()
    );

    let photos = WalkDir::new(input_dir)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
        .filter(|entry| {
            match entry
                .path()
                .extension()
                .and_then(|ext| ext.to_str().map(|s| s.to_lowercase()))
            {
                Some(ref e) if SUPPORTED_EXTENSIONS.contains(&e.as_str()) => true,
                _ => false,
            }
        })
        .enumerate()
        .filter_map(|(idx, e)| {
            let exif = match File::open(e.path()) {
                Ok(file) => exif::Reader::new()
                    .continue_on_error(true)
                    .read_from_container(&mut BufReader::new(&file))
                    .or_else(|err| {
                        err.distill_partial_result(|errors| {
                            eprintln!("{}: {} warning(s)", e.path().display(), errors.len());
                            errors.iter().for_each(|e| eprintln!("  {}", e));
                        })
                    })
                    .ok()?,
                _ => return None,
            };

            let name = e.file_name().to_string_lossy().to_string();
            let path = e.path();
            let latitude = get_coord(&exif, Tag::GPSLatitude, Tag::GPSLatitudeRef, "N")?;
            let longitude = get_coord(&exif, Tag::GPSLongitude, Tag::GPSLongitudeRef, "E")?;
            let make = get_string(&exif, Tag::Make).unwrap_or(UNKNOWN.to_string());
            let model = get_string(&exif, Tag::Model).unwrap_or(UNKNOWN.to_string());
            let date = get_datetime(&exif, Tag::DateTimeOriginal).unwrap_or(UNKNOWN.to_string());
            let thumb = get_thumbnail_data(&exif)
                .and_then(|data| save_thumbnail(format!("{}/t{}.jpg", thumbs_dir, idx), data))?;

            Some(PhotoInfo {
                name,
                path: path.display().to_string().replace("\\", "/"),
                thumb,
                lat: latitude as f32,
                lon: longitude as f32,
                make,
                model,
                date,
            })
        })
        .filter(|i| i.lat.abs() > 0.001 && i.lon.abs() > 0.001)
        .collect::<Vec<PhotoInfo>>();

    println!("Found {} photo coordinates", photos.len());
    if photos.is_empty() {
        return ExitCode::SUCCESS;
    }

    let map_json = serde_json::to_string(&photos).unwrap_or("[]".to_string());
    let html = String::from_utf8_lossy(MAP_HTML).replace("{map:1}", &map_json);
    let mut file = File::create("map.html").expect("Could not create map.html file");
    file.write_all(html.as_bytes()).expect("Could not write to map.html file");
    ExitCode::SUCCESS
}

fn get_coord(exif: &exif::Exif, tag: Tag, tag_ref: Tag, positive_char: &str) -> Option<f64> {
    exif.get_field(tag, In::PRIMARY)
        .and_then(|f| match f.value {
            Value::Rational(ref v) if v.len() >= 3 => {
                Some(v[0].to_f64() + v[1].to_f64() / 60.0 + v[2].to_f64() / 3600.0)
            }
            _ => None,
        })
        .and_then(|value| {
            let char = get_string(&exif, tag_ref).unwrap_or(positive_char.to_string());
            return Some(value * if char.eq(positive_char) { 1.0 } else { -1.0 });
        })
}

fn get_string(exif: &exif::Exif, tag: Tag) -> Option<String> {
    exif.get_field(tag, In::PRIMARY)
        .and_then(|f| match f.value {
            Value::Ascii(ref v) => Some(
                v.iter()
                    .map(|s| String::from_utf8_lossy(s))
                    .collect::<String>()
                    .trim()
                    .to_string(),
            ),
            _ => None,
        })
}

fn get_datetime(exif: &exif::Exif, tag: Tag) -> Option<String> {
    exif.get_field(tag, In::PRIMARY)
        .and_then(|f| match f.value {
            Value::Ascii(ref v) if !v.is_empty() => {
                DateTime::from_ascii(&v[0]).map(|s| s.to_string()).ok()
            }
            _ => None,
        })
}

fn get_thumb_uint(exif: &exif::Exif, tag: Tag) -> usize {
    exif.get_field(tag, In::THUMBNAIL)
        .and_then(|f| f.value.get_uint(0))
        .map(|v| v as usize)
        .unwrap_or(0)
}

fn get_thumbnail_data(exif: &exif::Exif) -> Option<&[u8]> {
    let thumb_offset = get_thumb_uint(exif, Tag::JPEGInterchangeFormat);
    let thumb_length = get_thumb_uint(exif, Tag::JPEGInterchangeFormatLength);
    if (thumb_offset == 0) || (thumb_length <= 0) {
        return None;
    }
    Some(&exif.buf()[thumb_offset..(thumb_offset + thumb_length)])
}

fn save_thumbnail(file_path: String, data: &[u8]) -> Option<String> {
    let mut file = File::create(&file_path).ok()?;
    file.write_all(data).ok()?;
    Some(file_path)
}
