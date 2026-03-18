import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';

import Dashboard from './pages/Dashboard';
import WordGenerate from './pages/WordGenerate';
import WordList from './pages/WordList';
import Learn from './pages/Learn';
import Settings from './pages/Settings';
import IncorrectNotes from './pages/IncorrectNotes';
import Guide from './pages/Guide';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="generate" element={<WordGenerate />} />
          <Route path="words" element={<WordList />} />
          <Route path="learn" element={<Learn />} />
          <Route path="incorrect" element={<IncorrectNotes />} />
          <Route path="settings" element={<Settings />} />
          <Route path="guide" element={<Guide />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App;
