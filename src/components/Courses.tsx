import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCourses } from '../lib/storage';
import { Map, Plus, ChevronRight, Activity, ArrowLeft } from 'lucide-react';

interface CourseRecord {
  id: string;
  name: string;
  teeSet: string;
  timestamp: number;
  holes: any[];
}

export function Courses() {
  const [courses, setCourses] = useState<CourseRecord[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    const records = await getCourses();
    records.sort((a, b) => b.timestamp - a.timestamp);
    setCourses(records as CourseRecord[]);
  };

  return (
    <div className="space-y-6 container mx-auto p-4 max-w-md pt-12 pb-24">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/')} className="p-2 border border-zinc-800 bg-zinc-900 rounded-full hover:bg-zinc-800 transition-colors">
          <ArrowLeft className="w-5 h-5 text-zinc-300" />
        </button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight text-white mb-1">Courses</h1>
          <p className="text-zinc-400 text-sm">Your saved scorecards and courses.</p>
        </div>
        <button 
          onClick={() => navigate('/scorecard')}
          className="p-2 bg-blue-600 hover:bg-blue-500 rounded-full text-white transition-colors"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {courses.length === 0 ? (
        <div className="border border-zinc-800 border-dashed rounded-xl p-12 flex flex-col items-center justify-center text-zinc-500 text-center">
           <Map className="w-12 h-12 mb-4 opacity-50" />
           <p className="font-medium text-zinc-400">No courses saved yet.</p>
           <p className="text-sm mt-2">Scan a scorecard to get started.</p>
           <button 
             onClick={() => navigate('/scorecard')}
             className="mt-6 px-6 py-2 bg-zinc-800 text-zinc-200 font-medium rounded-lg text-sm hover:bg-zinc-700 transition"
           >
             Scan Scorecard
           </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {courses.map(course => (
            <div key={course.id} className="border border-zinc-800 bg-zinc-900/50 rounded-xl p-3 flex items-center justify-between hover:bg-zinc-800 transition-colors cursor-pointer" onClick={() => navigate(`/course/${course.id}`)}>
              <div className="flex items-center gap-3">
                {course.aerialImageUrl ? (
                  <div className="w-12 h-12 rounded-lg overflow-hidden border border-zinc-800 shrink-0 bg-black shadow-sm">
                    <img
                      src={course.aerialImageUrl}
                      alt={`${course.name} aerial map`}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-zinc-950 border border-zinc-850 flex items-center justify-center shrink-0 text-zinc-500 shadow-sm">
                    <Map className="w-5 h-5" />
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-sm text-zinc-100 line-clamp-1">{course.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] uppercase font-bold tracking-wider bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
                      {course.teeSet}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {course.holes.length} holes
                    </span>
                  </div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-zinc-500 shrink-0" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
