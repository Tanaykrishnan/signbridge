"""Pinned research assets. Never deserialize arbitrary uploaded checkpoints or pickle files."""

import hashlib
import pickle
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / '.local-isl'
HASHES = {
    'upstream/SignVQVAE.py': '69335e3ae68c9bfeeaa36ef1ba5e9e801cab25663e56d418635fd8f3fbaad648',
    'upstream/constants.py': 'b77639cb4b05784d083377982e1ab6593033ff3d74708dd5eb7f1316615609cd',
    'upstream/encdec.py': '1a012d9ecb11e7fb814b59148ec8b297575e912f49b466a49e45b6b7f3d77b64',
    'upstream/model_params.py': '2407db1bd774c5d924090ada774be4ae107d23ef75fd563615185bc7302c0372',
    'upstream/quantize_cnn.py': '3428525b0c4463315fea73dea9ea1c79ae68cab35c73aa65b7190636d15ed3b0',
    'upstream/resnet.py': 'f5e79053ca6b5bf4c896dbb7ce97c472f8e996d0104463fb5af5cca05cea2cd5',
    'model_best_loss.pt': '8aafb7cfe281aa58dfdb1a5eef3ed6b9ac1c2cd74cb121bbef122bda6f0aca6e',
    'encoded_data_FDMSE-ISL_SignVQVAE_241108_1706_filtered.pkl': '27e76faadf3f7f537e2c79ea81b4b51b23eb84fc474db7434e4deaf4ee2ca164',
    'encoded_data_FDMSE-ISL_SignVQVAE_241108_1706_trim_info_filtered.pkl': '222a25b558a472c847b5809d0b262add96930ab5d75d5de220a7c35822a82c86',
    'metadata_fdmse_filtered.csv': '917aaa8d3ce38d41cf110c722867bb68e31eb74bda387a9985e2755a54901245',
}


def verify_assets():
    for name, expected in HASHES.items():
        with (DATA / name).open('rb') as source:
            actual = hashlib.file_digest(source, 'sha256').hexdigest()
        if actual != expected:
            raise ValueError(f'Research asset checksum mismatch: {name}')


class NumericUnpickler(pickle.Unpickler):
    def find_class(self, module, name):
        allowed = {
            ('numpy._core.multiarray', '_reconstruct'): np._core.multiarray._reconstruct,
            ('numpy', 'ndarray'): np.ndarray,
            ('numpy', 'dtype'): np.dtype,
        }
        if (module, name) not in allowed:
            raise pickle.UnpicklingError(f'Forbidden pickle global: {module}.{name}')
        return allowed[(module, name)]


def numeric_pickle(name):
    with (DATA / name).open('rb') as source:
        return NumericUnpickler(source).load()
