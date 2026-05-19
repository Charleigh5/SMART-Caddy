import { openDB, DBSchema } from 'idb';

interface GolfDB extends DBSchema {
  swingVideos: {
    key: string;
    value: {
      id: string;
      blob: Blob;
      timestamp: number;
      viewAngle: string;
      analyzed: boolean;
      analysis?: any;
    };
  };
  courses: {
    key: string;
    value: {
      id: string;
      name: string;
      teeSet: string;
      holes: {
        number: number;
        par: number;
        yardage?: number;
        handicap?: number;
      }[];
      timestamp: number;
    };
  };
  rounds: {
    key: string;
    value: {
      id: string;
      courseId: string;
      timestamp: number;
      completed: boolean;
      scores: Record<number, number>;
    };
  };
  shots: {
    key: string;
    value: {
      id: string;
      roundId: string;
      holeNumber: number;
      club: string;
      lie: string;
      result: string;
      penalty: number;
      gps?: { lat: number; lng: number };
      timestamp: number;
    };
    indexes: { 'by-round': string };
  };
  coachingNotes: {
    key: string;
    value: {
      id: string;
      videoId: string;
      note: string;
      timestamp: number;
    };
  };
  drills: {
    key: string;
    value: {
      id: string;
      videoId: string;
      drill: string;
      timestamp: number;
    };
  };
}

export async function initDB() {
  return await openDB<GolfDB>('golf-caddy-db', 4, {
    upgrade(db, oldVersion, newVersion, transaction) {
      if (!db.objectStoreNames.contains('swingVideos')) {
        db.createObjectStore('swingVideos', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('courses')) {
        db.createObjectStore('courses', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('rounds')) {
        db.createObjectStore('rounds', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('shots')) {
        const shotStore = db.createObjectStore('shots', { keyPath: 'id' });
        shotStore.createIndex('by-round', 'roundId');
      }
      if (!db.objectStoreNames.contains('coachingNotes')) {
        db.createObjectStore('coachingNotes', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('drills')) {
        db.createObjectStore('drills', { keyPath: 'id' });
      }
    },
  });
}

export async function saveSwingVideo(blob: Blob, viewAngle: string) {
  const db = await initDB();
  const id = crypto.randomUUID();
  await db.add('swingVideos', {
    id,
    blob,
    timestamp: Date.now(),
    viewAngle,
    analyzed: false
  });
  return id;
}

export async function getSwingVideos() {
  const db = await initDB();
  return await db.getAll('swingVideos');
}

export async function getSwingVideo(id: string) {
  const db = await initDB();
  return await db.get('swingVideos', id);
}

export async function deleteSwingVideo(id: string) {
  const db = await initDB();
  return await db.delete('swingVideos', id);
}

export async function saveCoachingNote(videoId: string, note: string) {
  const db = await initDB();
  const id = crypto.randomUUID();
  await db.add('coachingNotes', {
    id,
    videoId,
    note,
    timestamp: Date.now()
  });
  return id;
}

export async function saveDrill(videoId: string, drill: string) {
  const db = await initDB();
  const id = crypto.randomUUID();
  await db.add('drills', {
    id,
    videoId,
    drill,
    timestamp: Date.now()
  });
  return id;
}

export async function getCoachingNotes() {
  const db = await initDB();
  return await db.getAll('coachingNotes');
}

export async function getDrills() {
  const db = await initDB();
  return await db.getAll('drills');
}

export async function saveSwingAnalysis(id: string, analysis: any) {
  const db = await initDB();
  const video = await db.get('swingVideos', id);
  if (video) {
    video.analyzed = true;
    (video as any).analysis = analysis;
    await db.put('swingVideos', video);
  }
}

export async function saveCourse(courseData: Omit<GolfDB['courses']['value'], 'id' | 'timestamp'>) {
  const db = await initDB();
  const id = crypto.randomUUID();
  await db.add('courses', {
    ...courseData,
    id,
    timestamp: Date.now()
  });
  return id;
}

export async function getCourses() {
  const db = await initDB();
  return await db.getAll('courses');
}

export async function getCourse(id: string) {
  const db = await initDB();
  return await db.get('courses', id);
}

export async function createRound(courseId: string) {
  const db = await initDB();
  const id = crypto.randomUUID();
  await db.add('rounds', {
    id,
    courseId,
    timestamp: Date.now(),
    completed: false,
    scores: {}
  });
  return id;
}

export async function getRound(id: string) {
  const db = await initDB();
  return await db.get('rounds', id);
}

export async function getRoundsByCourse(courseId: string) {
  const db = await initDB();
  const rounds = await db.getAll('rounds');
  return rounds.filter(r => r.courseId === courseId).sort((a, b) => b.timestamp - a.timestamp);
}

export async function updateRoundScore(roundId: string, holeNumber: number, score: number) {
  const db = await initDB();
  const round = await db.get('rounds', roundId);
  if (round) {
    round.scores[holeNumber] = score;
    await db.put('rounds', round);
  }
}

export async function updateRoundCompletion(roundId: string, completed: boolean) {
  const db = await initDB();
  const round = await db.get('rounds', roundId);
  if (round) {
    round.completed = completed;
    await db.put('rounds', round);
  }
}

export async function addShot(shot: Omit<GolfDB['shots']['value'], 'id' | 'timestamp'>) {
  const db = await initDB();
  const id = crypto.randomUUID();
  await db.add('shots', {
    ...shot,
    id,
    timestamp: Date.now()
  });
  return id;
}

export async function getShotsByRound(roundId: string) {
  const db = await initDB();
  const shots = await db.getAllFromIndex('shots', 'by-round', roundId);
  return shots.sort((a, b) => a.timestamp - b.timestamp);
}

export async function updateShot(shot: any) {
  const db = await initDB();
  await db.put('shots', shot);
}

export async function deleteShot(id: string) {
  const db = await initDB();
  await db.delete('shots', id);
}

export async function exportDatabase() {
  const db = await initDB();
  const exportData = {
    courses: await db.getAll('courses'),
    rounds: await db.getAll('rounds'),
    shots: await db.getAll('shots'),
    swingVideos: [] as any[] // we will omit the actual blobs so JSON doesn't explode
  };
  
  const videos = await db.getAll('swingVideos');
  for (const v of videos) {
    exportData.swingVideos.push({
       id: v.id,
       timestamp: v.timestamp,
       viewAngle: v.viewAngle,
       analyzed: v.analyzed,
       analysis: (v as any).analysis || null
    });
  }
  
  return exportData;
}

export async function clearDatabase() {
  const db = await initDB();
  await db.clear('shots');
  await db.clear('rounds');
  await db.clear('courses');
  await db.clear('swingVideos');
}
