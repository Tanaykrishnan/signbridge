# Third-party data notices

## Optional local SignVQVAE research installation

`npm run isl:setup` downloads the authors' public [SignVQVAE demo release](https://github.com/suvajit-patra/sl-vqvae-gen-demo), pinned to commit `b0e3d4f57d9804fd2a8dfc3e08a14eaadafa13e6`, into ignored `.local-isl/`. Suvajit Patra and collaborators' repository README declares MIT for the project; no separate checkpoint/encoded-data license notice was found. Commercial permissions are **not established**. No license grant for those assets is invented here, and the project MIT license does not relicense them. The local adapter is development-only research evaluation pending rights clarification and linguistic review. No third-party FBX avatar is extracted or used. See [complete provenance, checksums, changes and restrictions](docs/local-isl-engine.md). Stanza and its English parser models retain their upstream notices. These optional model assets are not part of the checked-in distribution.

## ISL-CSLTR text annotations

`src/data/isl-csltr.json` includes the Sentence and SIGN GLOSSES columns from:

Elakkiya R; NATARAJAN B (2021), **ISL-CSLTR: Indian Sign Language Dataset for Continuous Sign Language Translation and Recognition**, Mendeley Data, version 1. DOI [10.17632/kcmpdxky7p.1](https://doi.org/10.17632/kcmpdxky7p.1).

Source: [dataset publication](https://data.mendeley.com/datasets/kcmpdxky7p/1), archive member `ISL_CSLRT_Corpus/corpus_csv_files/ISL Corpus sign glosses.csv`.

Licensed by the publisher under **[Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/)** ([legal code](https://creativecommons.org/licenses/by/4.0/legalcode.en)). The project's MIT license does not replace this data license.

Changes: extracted the two text columns to JSON; removed surrounding whitespace; added citation and license fields. Source spelling and gloss wording are retained. No videos, signer photographs or trained model weights are included. The authors do not endorse SignBridge or the rendered animations. Redistribution must retain attribution and indicate further changes.

## References for original animation code

The seven original ISL greeting approximations reference [NISH EIP Magazine 2020](https://nish.ac.in/docs/EIP_Magazine_2020.pdf#page=21), PDF page 21 / printed page 36. No publication media is redistributed or relicensed. Original numeric animations await expert review; they are separate from the ISL-CSLTR data above.

ASL reference sources and limitations are documented in [docs/fingerspelling.md](docs/fingerspelling.md). Dependencies retain their respective package licenses. Kaggle and GitHub datasets supplied for assessment are not redistributed in this repository.
