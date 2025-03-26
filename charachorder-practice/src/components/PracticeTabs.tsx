import { useState } from "react";
import { CharacterPractice } from "./CharacterPractice";
import { DynamicPractice } from "./DynamicPractice";
import { AnkiMemorySystem } from "./AnkiMemorySystem";
import { ChordAnkiSystem } from "./ChordAnkiSystem";
import "./PracticeTabs.css";

// Define the main practice types
type PracticeType = "sequential" | "dynamic" | "anki";

// Define the anki practice subtypes
type AnkiSubType = "letters" | "chords";

export const PracticeTabs = () => {
  // Main practice type (sequential, dynamic, anki)
  const [activeTab, setActiveTab] = useState<PracticeType>("anki");

  // Anki subtype (letters or chords)
  const [ankiSubType, setAnkiSubType] = useState<AnkiSubType>("letters");

  return (
    <div className="practice-tabs">
      {/* Main tab buttons */}
      <div className="tab-buttons">
        <button
          className={`tab-button ${activeTab === "sequential" ? "active" : ""}`}
          onClick={() => setActiveTab("sequential")}
        >
          Sequential Practice
        </button>
        <button
          className={`tab-button ${activeTab === "dynamic" ? "active" : ""}`}
          onClick={() => setActiveTab("dynamic")}
        >
          Dynamic Practice
        </button>
        <button
          className={`tab-button ${activeTab === "anki" ? "active" : ""}`}
          onClick={() => setActiveTab("anki")}
        >
          Anki Memory
        </button>
      </div>

      {/* Anki subtabs - only shown when Anki is active */}
      {activeTab === "anki" && (
        <div className="anki-subtabs">
          <button
            className={`subtab-button ${
              ankiSubType === "letters" ? "active" : ""
            }`}
            onClick={() => setAnkiSubType("letters")}
          >
            Letters
          </button>
          <button
            className={`subtab-button ${
              ankiSubType === "chords" ? "active" : ""
            }`}
            onClick={() => setAnkiSubType("chords")}
          >
            Chords
          </button>
        </div>
      )}

      {/* Content area */}
      <div className="tab-content">
        {activeTab === "sequential" ? (
          <CharacterPractice />
        ) : activeTab === "dynamic" ? (
          <DynamicPractice />
        ) : ankiSubType === "letters" ? (
          <AnkiMemorySystem />
        ) : (
          <ChordAnkiSystem />
        )}
      </div>
    </div>
  );
};
