import { useState } from "react";
import { CharacterPractice } from "./CharacterPractice";
import { DynamicPractice } from "./DynamicPractice";
import "./PracticeTabs.css";

export const PracticeTabs = () => {
  const [activeTab, setActiveTab] = useState<"sequential" | "dynamic">(
    "sequential"
  );

  return (
    <div className="practice-tabs">
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
      </div>
      <div className="tab-content">
        {activeTab === "sequential" ? (
          <CharacterPractice />
        ) : (
          <DynamicPractice />
        )}
      </div>
    </div>
  );
};
