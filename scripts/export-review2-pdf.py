"""Export the inspected slide renders as a presentation PDF."""
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from pypdf import PdfReader
root = Path(__file__).resolve().parents[1]
target = root / 'outputs/SignBridge-Review2.pdf'
c = canvas.Canvas(str(target), pagesize=(960, 540))
c.setTitle('SignBridge - Review 2 - Applied Generative AI')
c.setAuthor('SignBridge team')
for index in range(1, 4):
    source = root / f'outputs/review2-render/slide-{index}.png'
    if not source.is_file():
        raise RuntimeError('Render and inspect the PowerPoint before exporting its PDF.')
    c.drawImage(ImageReader(str(source)), 0, 0, width=960, height=540)
    c.showPage()
c.save()
assert len(PdfReader(target).pages) == 3
print(f'Saved {target}; three 16:9 pages. Editable content remains in the PPTX.')
