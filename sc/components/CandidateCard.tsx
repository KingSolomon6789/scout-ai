
import React from 'react';
import { Candidate } from '../types';

interface CandidateCardProps {
  candidate: Candidate;
  rank: number;
}

export const CandidateCard: React.FC<CandidateCardProps> = ({ candidate, rank }) => {
  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    if (score >= 70) return 'text-blue-600 bg-blue-50 border-blue-200';
    return 'text-amber-600 bg-amber-50 border-amber-200';
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 transition-all hover:shadow-md">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold border border-slate-200">
            {rank}
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">{candidate.name}</h3>
            <p className="text-sm text-slate-500">{candidate.email || 'No email provided'}</p>
          </div>
        </div>
        <div className={`px-4 py-2 rounded-lg border font-bold text-lg ${getScoreColor(candidate.score)}`}>
          {candidate.score}%
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">AI Analysis</h4>
          <p className="text-sm text-slate-600 leading-relaxed">{candidate.reasoning}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-2">Top Skills</h4>
            <div className="flex flex-wrap gap-1">
              {candidate.topSkills.map((skill, idx) => (
                <span key={idx} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[11px] font-medium rounded border border-emerald-100">
                  {skill}
                </span>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-rose-600 uppercase tracking-wider mb-2">Gaps</h4>
            <div className="flex flex-wrap gap-1">
              {candidate.missingRequirements.map((gap, idx) => (
                <span key={idx} className="px-2 py-0.5 bg-rose-50 text-rose-700 text-[11px] font-medium rounded border border-rose-100">
                  {gap}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-50 flex gap-6 text-sm">
          <div className="flex flex-col">
            <span className="text-slate-400 text-xs">Experience</span>
            <span className="font-semibold text-slate-700">{candidate.experienceYears} Years</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-400 text-xs">Education</span>
            <span className="font-semibold text-slate-700 truncate max-w-[200px]">{candidate.education || 'N/A'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
