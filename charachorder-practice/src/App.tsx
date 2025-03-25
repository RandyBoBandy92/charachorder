import { PracticeTabs } from "./components/PracticeTabs";
import "./App.css";

function App() {
  return (
    <div className="App">
      <header>
        <h1>CharaChorder Practice</h1>
        <p>Choose your practice mode and start mastering the CharaChorder!</p>
      </header>
      <main>
        <PracticeTabs />
      </main>
      <footer>
        <p>Practice regularly for best results!</p>
      </footer>
    </div>
  );
}

export default App;
