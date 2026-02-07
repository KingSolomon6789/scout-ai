
import { GoogleGenAI, Type } from "@google/genai";
import { Candidate, AnalysisResult } from "../types";

export const analyzeAllResumes = async (
  jobDescription: string,
  resumes: { name: string; text: string }[]
): Promise<AnalysisResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Format the entire pool for the large context window
  const resumesFormatted = resumes.map((r, index) => `[CANDIDATE #${index + 1}]\nFILE: ${r.name}\nCONTENT:\n${r.text}`).join("\n\n---\n\n");

  const prompt = `
    You are an expert recruiter. I am providing you with a Job Description and a pool of ${resumes.length} resumes.
    
    JOB DESCRIPTION:
    ${jobDescription}
    
    CANDIDATE POOL:
    ${resumesFormatted}
    
    TASK:
    Analyze ALL provided resumes simultaneously. Compare them against each other and the job requirements.
    
    REQUIRED OUTPUT:
    1. A high-level summary of the entire candidate pool.
    2. A ranked list of candidates. 
    3. For each candidate, provide:
       - A score (0-100) based on requirements match.
       - A detailed 'reasoning' string explaining their fit.
       - Top technical/soft skills found.
       - Missing requirements or potential red flags.
       - Estimated years of experience and highest education.
    
    IMPORTANT: If there are more than 50 candidates, focus the detailed JSON objects on the top 50 best matches to ensure response quality, but acknowledge the total count in the summary.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: {
            type: Type.STRING,
            description: "A strategic overview of the total pool and general suitability."
          },
          topCandidates: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                name: { type: Type.STRING },
                email: { type: Type.STRING },
                score: { type: Type.NUMBER },
                reasoning: { type: Type.STRING },
                topSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
                missingRequirements: { type: Type.ARRAY, items: { type: Type.STRING } },
                experienceYears: { type: Type.NUMBER },
                education: { type: Type.STRING }
              },
              required: ["name", "score", "reasoning", "topSkills", "missingRequirements"]
            }
          }
        },
        required: ["summary", "topCandidates"]
      }
    }
  });

  const jsonStr = response.text.trim();
  try {
    return JSON.parse(jsonStr) as AnalysisResult;
  } catch (e) {
    console.error("Failed to parse AI response:", jsonStr);
    throw new Error("The AI response was malformed. Try a slightly smaller set or check document content.");
  }
};
