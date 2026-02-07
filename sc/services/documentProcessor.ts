
// @ts-ignore
const pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// @ts-ignore
const mammoth = window.mammoth;

export const extractTextFromFile = async (file: File): Promise<string> => {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'pdf') {
    return extractTextFromPdf(file);
  } else if (extension === 'docx') {
    return extractTextFromDocx(file);
  } else if (extension === 'doc') {
     return "[Legacy .doc files not supported, please convert to .docx or .pdf]";
  }
  
  return `[Unsupported file format: ${extension}]`;
};

const extractTextFromPdf = async (file: File): Promise<string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const strings = content.items.map((item: any) => item.str);
      fullText += strings.join(" ") + "\n";
    }

    return fullText;
  } catch (error) {
    console.error(`Error parsing PDF ${file.name}:`, error);
    return `[Error parsing ${file.name}]`;
  }
};

const extractTextFromDocx = async (file: File): Promise<string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value; // The raw text
  } catch (error) {
    console.error(`Error parsing DOCX ${file.name}:`, error);
    return `[Error parsing DOCX ${file.name}]`;
  }
};
