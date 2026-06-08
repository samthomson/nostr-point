import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ScrollToTop } from "./components/ScrollToTop";

import Index from "./pages/Index";
import EditPresentation from "./pages/EditPresentation";
import PresentationViewer from "./pages/PresentationViewer";
import PresenterMode from "./pages/PresenterMode";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

export function AppRouter() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/new" element={<EditPresentation />} />
        <Route path="/settings" element={<Settings />} />
        {/* Presenter mode - must come before generic nip19 route */}
        <Route path="/:nip19/present" element={<PresenterMode />} />
        {/* Edit existing presentation */}
        <Route path="/:nip19/edit" element={<EditPresentation />} />
        {/* View presentation (handles naddr for presentations) */}
        <Route path="/:nip19" element={<PresentationViewer />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
export default AppRouter;
