# capture.py — run on the Pi
import cv2
import time
import hashlib
import os
import json
import argparse
from datetime import datetime, timezone

try:
    from sense_hat import SenseHat

    sense = SenseHat(imu_only=True)
    print("Sense HAT sensors detected")
    SENSE_HAT_AVAILABLE = True
except Exception as e:
    print(f"Sense HAT sensor failure: {e}")
    print("Check GPIO alignment and I2C addresses with: sudo i2cdetect -y 1")
    SENSE_HAT_AVAILABLE = False


def hash_file(path):
    """Return SHA-256 hash of a file's contents."""
    sha256 = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            sha256.update(chunk)
    return sha256.hexdigest()


def read_sensors():
    """Read the current Sense HAT sensor values."""
    if not SENSE_HAT_AVAILABLE:
        return None

    orientation = sense.get_orientation()
    accel = sense.get_accelerometer_raw()
    gyro = sense.get_gyroscope_raw()
    temperature = sense.get_temperature()

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "orientation_deg": orientation,
        "accel_g": accel,
        "gyro_rad_s": gyro,
        "temperature_c": round(temperature, 2),
    }


def main():
    parser = argparse.ArgumentParser(
        description="Capture video clips with Sense HAT sensor metadata."
    )
    parser.add_argument(
        "--duration",
        type=int,
        default=300,
        help="Clip duration in seconds (default: 300 / 5 minutes)",
    )
    parser.add_argument(
        "--sensor-interval",
        type=float,
        default=1.0,
        help="Seconds between sensor readings (default: 1)",
    )
    parser.add_argument("--fps", type=int, default=15)
    parser.add_argument("--width", type=int, default=640)
    parser.add_argument("--height", type=int, default=480)
    parser.add_argument(
        "--outdir",
        type=str,
        default="./data",
        help="Directory where clip folders are created",
    )
    parser.add_argument("--device", type=int, default=0)
    args = parser.parse_args()

    resolution = (args.width, args.height)
    os.makedirs(args.outdir, exist_ok=True)

    cap = cv2.VideoCapture(args.device)

    if not cap.isOpened():
        print("Could not open webcam")
        return

    fourcc = cv2.VideoWriter_fourcc(*"MJPG")

    print(
        f"Starting capture loop "
        f"({args.duration}s clips, {args.fps}fps, "
        f"{resolution[0]}x{resolution[1]}). Ctrl+C to stop."
    )

    try:
        while True:
            clip_timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
            clip_dir = os.path.join(args.outdir, f"clip_{clip_timestamp}")
            os.makedirs(clip_dir, exist_ok=True)

            video_filename = os.path.join(
                clip_dir, f"clip_{clip_timestamp}.avi"
            )
            metadata_filename = os.path.join(clip_dir, "metadata.json")
            sensor_filename = os.path.join(clip_dir, "sensor_data.json")

            writer = cv2.VideoWriter(
                video_filename,
                fourcc,
                args.fps,
                resolution,
            )

            if not writer.isOpened():
                print(f"Could not create video file: {video_filename}")
                break

            sensor_samples = []
            start_time = time.monotonic()
            next_sensor_reading = start_time
            frame_count = 0

            print(f"Recording: {clip_dir}")

            while time.monotonic() - start_time < args.duration:
                ret, frame = cap.read()

                if not ret:
                    print("Frame read failed")
                    break

                frame = cv2.resize(frame, resolution)
                writer.write(frame)
                frame_count += 1

                now = time.monotonic()

                if now >= next_sensor_reading:
                    sensor_data = read_sensors()

                    if sensor_data is not None:
                        sensor_samples.append(sensor_data)

                    next_sensor_reading = now + args.sensor_interval

            writer.release()

            elapsed = time.monotonic() - start_time
            clip_hash = hash_file(video_filename)

            metadata = {
                "filename": os.path.basename(video_filename),
                "hash": clip_hash,
                "started_at": clip_timestamp,
                "duration_s": round(elapsed, 2),
                "frame_count": frame_count,
                "resolution": {
                    "width": args.width,
                    "height": args.height,
                },
                "fps_target": args.fps,
                "sensor_interval_s": args.sensor_interval,
                "sensor_sample_count": len(sensor_samples),
                "sensor_data_file": os.path.basename(sensor_filename),
            }

            with open(sensor_filename, "w", encoding="utf-8") as f:
                json.dump(sensor_samples, f, indent=2)

            with open(metadata_filename, "w", encoding="utf-8") as f:
                json.dump(metadata, f, indent=2)

            print(
                f"Clip saved: {video_filename} "
                f"({frame_count} frames in {elapsed:.1f}s)"
            )
            print(f"Hash: {clip_hash}")
            print(f"Sensor samples saved: {sensor_filename}")

    except KeyboardInterrupt:
        print("\nStopping.")

    finally:
        cap.release()


if __name__ == "__main__":
    main()