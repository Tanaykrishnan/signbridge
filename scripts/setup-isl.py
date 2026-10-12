"""Download the pinned public SignVQVAE research release into an isolated local directory."""

import hashlib
import json
from pathlib import Path
import shutil
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / '.local-isl'
REVISION = 'b0e3d4f57d9804fd2a8dfc3e08a14eaadafa13e6'
REPOSITORY = 'https://github.com/suvajit-patra/sl-vqvae-gen-demo'
ARCHIVE = 'https://drive.usercontent.google.com/download?id=1kEGrlCusraNNBhTnlvAFCzi9dW4_e_9F&export=download&confirm=t'
ARCHIVE_SIZE = 402504406
SOURCE_FILES = ['SignVQVAE.py', 'constants.py', 'encdec.py', 'model_params.py', 'quantize_cnn.py', 'resnet.py', 'dataTransform.py']
DATA_FILES = ['model_best_loss.pt', 'encoded_data_FDMSE-ISL_SignVQVAE_241108_1706_filtered.pkl', 'encoded_data_FDMSE-ISL_SignVQVAE_241108_1706_trim_info_filtered.pkl', 'metadata_fdmse_filtered.csv']


def download(url, destination, limit):
    temporary = destination.with_suffix(destination.suffix + '.part')
    total = 0
    with urllib.request.urlopen(url, timeout=60) as response, temporary.open('wb') as output:
        while chunk := response.read(1024 * 1024):
            total += len(chunk)
            if total > limit:
                raise ValueError('Download exceeds the pinned size limit')
            output.write(chunk)
            if total % (32 * 1024 * 1024) == 0:
                print(f'Downloaded {total // (1024 * 1024)} MiB', flush=True)
    temporary.replace(destination)


def main():
    DEST.mkdir(exist_ok=True)
    package = DEST / 'upstream'
    package.mkdir(exist_ok=True)
    hashes = {}
    for name in SOURCE_FILES:
        destination = package / name
        if not destination.exists():
            download(f'https://raw.githubusercontent.com/suvajit-patra/sl-vqvae-gen-demo/{REVISION}/input/SignVQVAE_241108_1706/{name}', destination, 100000)
        hashes[name] = hashlib.sha256(destination.read_bytes()).hexdigest()
    readme = DEST / 'UPSTREAM-README.md'
    if not readme.exists():
        download(f'https://raw.githubusercontent.com/suvajit-patra/sl-vqvae-gen-demo/{REVISION}/README.md', readme, 100000)
    archive = DEST / 'sign-vqvae.zip'
    if not archive.exists():
        download(ARCHIVE, archive, ARCHIVE_SIZE)
    if archive.stat().st_size != ARCHIVE_SIZE:
        raise ValueError('The upstream archive changed or is incomplete')
    with zipfile.ZipFile(archive) as bundle:
        for name in DATA_FILES:
            matches = [entry for entry in bundle.infolist() if Path(entry.filename).name == name]
            if len(matches) != 1 or matches[0].file_size > 600 * 1024 * 1024:
                raise ValueError(f'Unexpected archive member: {name}')
            destination = DEST / name
            if not destination.exists():
                with bundle.open(matches[0]) as source, destination.open('wb') as output:
                    shutil.copyfileobj(source, output)
            with destination.open('rb') as handle:
                hashes[name] = hashlib.file_digest(handle, 'sha256').hexdigest()
    # The third-party avatar is deliberately excluded; SignBridge uses its original rig.
    provenance = {
        'repository': REPOSITORY,
        'revision': REVISION,
        'archive': ARCHIVE,
        'archiveBytes': ARCHIVE_SIZE,
        'files': hashes,
        'codeLicense': 'MIT declared in upstream README',
        'assetLicense': 'No separate weights or encoded-data license was found in the release',
        'commercialUseEstablished': False,
        'scope': 'Local research evaluation only; no expert linguistic review',
    }
    (DEST / 'provenance.json').write_text(json.dumps(provenance, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'downloaded': True, 'revision': REVISION, 'files': list(hashes)}, indent=2), flush=True)


if __name__ == '__main__':
    main()
