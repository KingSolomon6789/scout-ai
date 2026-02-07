
export interface Candidate {
  id: string;
  name: string;
  email: string;
  score: number;
  reasoning: string;
  topSkills: string[];
  missingRequirements: string[];
  experienceYears: number;
  education: string;
}

export interface AnalysisResult {
  topCandidates: Candidate[];
  summary: string;
}

export interface ProcessingState {
  status: 'idle' | 'parsing' | 'analyzing' | 'completed' | 'error';
  progress: number;
  message: string;
}
