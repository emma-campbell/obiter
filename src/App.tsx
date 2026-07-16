import { NoteView } from "./notes/NoteView";
import { SAMPLE_NOTE, SAMPLE_NOTE_NAME, SAMPLE_NOTE_PATH } from "./notes/sample-note";

function App() {
  return (
    <NoteView dirLabel={SAMPLE_NOTE_PATH} fileName={SAMPLE_NOTE_NAME} markdown={SAMPLE_NOTE} />
  );
}

export default App;
