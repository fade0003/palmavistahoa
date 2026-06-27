const fs = require('fs');
const path = require('path');

const docsDir = path.join(__dirname, 'public', 'docs');

if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir, { recursive: true });
}

const pdfContent = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n4 0 obj\n<< /Length 73 >>\nstream\nBT\n/F1 24 Tf\n100 700 Td\n(This is a placeholder PDF document.) Tj\nET\nendstream\nendobj\n5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000219 00000 n \n0000000343 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n431\n%%EOF\n", 'utf8');

const docs = [
  "Articles_of_Incorporation.pdf",
  "Master_Declaration.pdf",
  "Bylaws.pdf",
  "5th_Amendment.pdf",
  "Assignment_of_Declarants_Rights.pdf",
  "Easement.pdf",
  "121021Rules_and_Regulations.pdf"
];

for (const doc of docs) {
  const filePath = path.join(docsDir, doc);
  fs.writeFileSync(filePath, pdfContent);
  console.log(`Created ${filePath}`);
}
