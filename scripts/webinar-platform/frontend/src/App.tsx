import { BrowserRouter, Routes, Route } from "react-router-dom";
import SchedulePage from "./pages/SchedulePage";
import WaitingRoom from "./pages/WaitingRoom";
import LiveRoom from "./pages/LiveRoom";
import ThankYou from "./pages/ThankYou";
import InvalidLink from "./pages/InvalidLink";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/webinar" element={<SchedulePage />} />
        <Route path="/webinar/sala/:sessionId" element={<WaitingRoom />} />
        <Route path="/webinar/sala/:sessionId/live" element={<LiveRoom />} />
        <Route path="/webinar/obrigado" element={<ThankYou />} />
        <Route path="/webinar/invalid" element={<InvalidLink />} />
      </Routes>
    </BrowserRouter>
  );
}
