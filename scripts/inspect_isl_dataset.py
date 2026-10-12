"""Inspect the public ISL-CSLTR ZIP using bounded HTTP ranges; no corpus extraction."""

import argparse
import collections
import csv
import io
import json
from pathlib import Path
import urllib.request
import zipfile

ARCHIVE = "https://prod-dcd-datasets-public-files-eu-west-1.s3.eu-west-1.amazonaws.com/5de8c65d-30ba-4362-941f-47d61d435aa0"
SOURCE = "https://data.mendeley.com/datasets/kcmpdxky7p/1"
SIZE = 8905822924


class RemoteArchive(io.RawIOBase):
    def __init__(self):
        self.position = 0
        self.transferred = 0

    def readable(self):
        return True

    def seekable(self):
        return True

    def tell(self):
        return self.position

    def seek(self, offset, whence=0):
        self.position = offset + (0 if whence == 0 else self.position if whence == 1 else SIZE)
        if self.position < 0:
            raise ValueError("Negative offset")
        return self.position

    def read(self, length=-1):
        length = min(SIZE - self.position, length if length >= 0 else SIZE)
        if length <= 0:
            return b""
        if length > 4 * 1024 * 1024 or self.transferred + length > 16 * 1024 * 1024:
            raise ValueError("Inspection download budget exceeded")
        end = self.position + length - 1
        request = urllib.request.Request(ARCHIVE, headers={"Range": f"bytes={self.position}-{end}"})
        with urllib.request.urlopen(request, timeout=30) as response:
            if response.status != 206 or response.headers.get("Content-Range") != f"bytes {self.position}-{end}/{SIZE}":
                raise ValueError("Server did not honor the bounded byte range")
            data = response.read(length + 1)
        if len(data) != length:
            raise ValueError("Incomplete or oversized range response")
        self.position += length
        self.transferred += length
        return data


def inspect(include_annotations=False, export_glosses=None):
    remote = RemoteArchive()
    with zipfile.ZipFile(remote) as archive:
        files = [entry for entry in archive.infolist() if not entry.is_dir()]
        counts = collections.Counter(entry.filename.rsplit(".", 1)[-1].lower() for entry in files)
        annotations = [entry for entry in files if entry.filename.lower().endswith((".csv", ".txt"))]
        report = {
            "source": SOURCE,
            "license": "CC BY 4.0 (publisher declaration)",
            "archiveBytes": SIZE,
            "fileTypes": dict(counts),
            "annotationFiles": [{"path": entry.filename, "bytes": entry.file_size} for entry in annotations],
            "videoExamples": [entry.filename for entry in files if entry.filename.lower().endswith(".mp4")][:8],
        }
        if include_annotations or export_glosses:
            previews = {}
            for entry in annotations:
                if entry.file_size > 1024 * 1024:
                    continue
                content = archive.read(entry).decode("utf-8-sig", errors="replace")
                if entry.filename.lower().endswith(".csv"):
                    rows = list(csv.reader(io.StringIO(content)))
                    previews[entry.filename] = {"rows": len(rows), "firstRows": rows[:6]}
                    if export_glosses and rows[0] == ["Sentence", "SIGN GLOSSES"]:
                        records = [{"text": row[0].strip(), "gloss": row[1].strip()} for row in rows[1:] if len(row) == 2 and row[0].strip() and row[1].strip()]
                        destination = Path(export_glosses)
                        if destination.exists():
                            raise ValueError("Export already exists; inspect it before choosing a new path")
                        destination.parent.mkdir(parents=True, exist_ok=True)
                        destination.write_text(json.dumps({
                            "source": SOURCE,
                            "doi": "10.17632/kcmpdxky7p.1",
                            "authors": ["Elakkiya R", "NATARAJAN B"],
                            "license": "CC BY 4.0",
                            "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
                            "attribution": "Elakkiya R; NATARAJAN B (2021), ISL-CSLTR, version 1. Sentence/gloss columns extracted from the publisher CSV; surrounding whitespace removed. No videos or images included.",
                            "records": records,
                        }, indent=2) + "\n", encoding="utf-8")
                        report["exportedGlosses"] = len(records)
                else:
                    previews[entry.filename] = content[:4000]
            report["annotationPreviews"] = previews
        report["bytesTransferred"] = remote.transferred
        return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--annotations", action="store_true", help="Read small text annotations, with a 16 MiB total download cap")
    parser.add_argument("--export-glosses", help="Write the publisher sentence/gloss pairs with attribution to a new JSON file")
    args = parser.parse_args()
    print(json.dumps(inspect(args.annotations, args.export_glosses), indent=2))
