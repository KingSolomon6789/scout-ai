# scout-ai
Scout  Ai turns a folder full of unorganized resume files into a ranked, analyzed, and interactive shortlist, significantly reducing the time it takes for recruiters to find the best candidates. lightbulb_
AI Talent Scout Pro is a comprehensive AI-powered recruitment and hiring tool. Its primary purpose is to automate the initial screening process of job candidates by analyzing their resumes against a specific job description.
Here is a breakdown of exactly what it does:
1. Document Ingestion & Parsing
•	Multi-Format Support: It accepts both PDF and DOCX files.
•	Text Extraction: It uses specific libraries (pdf.js and mammoth.js) to read and extract raw text from these uploaded resumes.
•	Document Merging: It combines all uploaded resumes into a single "Master PDF" file. This allows HR to download one consolidated document containing every applicant's resume instead of opening dozens of individual files.
2. AI Analysis (The "Engine")
•	Contextual Screening: It takes the text from all uploaded resumes and the provided Job Description and sends them to Google's Gemini 3 Flash model.
•	Ranking & Scoring: The AI compares every candidate against the job requirements simultaneously. It assigns a suitability score (0-100) to each candidate.
•	Structured Data Extraction: For each candidate, it automatically extracts:
o	Years of experience.
o	Education level.
o	Top technical/soft skills.
o	Missing requirements (gap analysis).
o	A qualitative "Reasoning" paragraph explaining why they were ranked that way.
3. Interactive HR Dashboard
•	Visual Reports: Displays a bar chart comparing the scores of the top candidates.
•	AI Cover Art: Uses Gemini 2.5 Flash Image to generate a unique, professional 3D cover image for the recruitment campaign based on the text of the job description.
•	Candidate Cards: detailed cards for every applicant showing their rank, score, and AI insights.
4. "Chat with Pool" Assistant
•	RAG-like Functionality: After processing, it enables a chat interface. The HR user can ask specific questions about the candidate pool, such as "Who has the most React experience?" or "Which candidates have leadership backgrounds?". The AI answers based only on the content of the uploaded resumes.
