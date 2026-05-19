import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Home } from './components/Home';
import { FeatureLedger } from './components/FeatureLedger';
import { Diagnostics } from './components/Diagnostics';
import { Permissions } from './components/Permissions';
import { SwingCapture } from './components/SwingCapture';
import { Caddy } from './components/Caddy';
import { Library } from './components/Library';
import { SwingReview } from './components/SwingReview';
import { ScorecardScanner } from './components/ScorecardScanner';
import { Courses } from './components/Courses';
import { CourseDetail } from './components/CourseDetail';
import { RoundDetail } from './components/RoundDetail';
import { Settings } from './components/Settings';
import { LiveErrorBoundary } from './components/live/LiveErrorBoundary';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/caddy" element={
            <LiveErrorBoundary fallbackMessage="The AR Viewfinder crashed. Please reload and ensure camera permissions are granted.">
              <Caddy />
            </LiveErrorBoundary>
          } />
          <Route path="/library" element={<Library />} />
          <Route path="/scorecards" element={<Courses />} />
          <Route path="/course/:id" element={<CourseDetail />} />
          <Route path="/scorecard" element={<ScorecardScanner />} />
          <Route path="/permissions" element={<Permissions />} />
          <Route path="/ledger" element={<FeatureLedger />} />
          <Route path="/diagnostics" element={<Diagnostics />} />
        </Route>
        <Route path="/capture" element={<SwingCapture />} />
        <Route path="/review/:id" element={<SwingReview />} />
        <Route path="/round/:id" element={<RoundDetail />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </BrowserRouter>
  );
}
