import React, { useState, useEffect, useRef } from "react";
import "./PracticeTabs.css"; // Reusing existing styles

export const CustomPractice = () => {
  const [inputText, setInputText] = useState("");
  const [units, setUnits] = useState<string[]>([]);
  const [currentUnitIndex, setCurrentUnitIndex] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [userInput, setUserInput] = useState("");
  const [isShuffled, setIsShuffled] = useState(false);
  const [isInterleaved, setIsInterleaved] = useState(false);
  const [practiceActive, setPracticeActive] = useState(false);
  const [completedCycles, setCompletedCycles] = useState(0);
  const [showCycleNotification, setShowCycleNotification] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Process text into units (words or letters) when submitted
  const processText = () => {
    if (!inputText.trim()) return;

    // Split by whitespace and filter out empty strings
    const processedUnits = inputText
      .trim()
      .split(/\s+/)
      .filter((unit) => unit);

    let finalUnits = [...processedUnits];

    // Apply interleaving if enabled (each unit appears 3 times interleaved)
    if (isInterleaved && processedUnits.length > 1) {
      // Create a pattern where each unit appears 3 times,
      // interleaved with other units to create contextual switching
      finalUnits = [];

      // For each unit, we'll add it 3 times with other units in between
      for (let i = 0; i < processedUnits.length; i++) {
        // Get the current unit
        const current = processedUnits[i];

        // Get neighboring units (with wraparound)
        const next =
          i < processedUnits.length - 1
            ? processedUnits[i + 1]
            : processedUnits[0];

        // First occurrence of current unit
        finalUnits.push(current);

        // Add next unit as interleaving
        finalUnits.push(next);

        // Second occurrence of current unit
        finalUnits.push(current);

        // Add next unit again for more interleaving
        finalUnits.push(next);

        // Third occurrence of current unit
        finalUnits.push(current);
      }
    }

    // Apply shuffle if enabled (after interleaving)
    if (isShuffled) {
      // Fisher-Yates shuffle algorithm
      for (let i = finalUnits.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [finalUnits[i], finalUnits[j]] = [finalUnits[j], finalUnits[i]];
      }
    }

    setUnits(finalUnits);
    setCurrentUnitIndex(0);
    setUserInput("");
    setPracticeActive(true);
    setShowModal(false);

    // Focus the input field after modal closes
    setTimeout(() => {
      if (inputRef.current) inputRef.current.focus();
    }, 100);
  };

  // Handle user input
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUserInput(value);

    // Check if the input matches the current unit
    if (value === units[currentUnitIndex]) {
      // Move to next unit or loop back to the beginning
      if (currentUnitIndex < units.length - 1) {
        setCurrentUnitIndex((prev) => prev + 1);
        setUserInput("");
      } else {
        // Loop back to the first unit
        setCurrentUnitIndex(0);
        setUserInput("");
        setCompletedCycles((prev) => prev + 1);

        // Show cycle completion notification
        setShowCycleNotification(true);
        setTimeout(() => {
          setShowCycleNotification(false);
        }, 1500);
      }
    }
  };

  // Reset practice
  const resetPractice = () => {
    setUnits([]);
    setCurrentUnitIndex(0);
    setUserInput("");
    setPracticeActive(false);
    setCompletedCycles(0);
  };

  // Start new practice
  const openInputModal = () => {
    setShowModal(true);
    setInputText("");
  };

  // Effect to focus input when practice is active
  useEffect(() => {
    if (practiceActive && inputRef.current) {
      inputRef.current.focus();
    }
  }, [practiceActive, currentUnitIndex]);

  return (
    <div className="custom-practice">
      <h2>Custom Practice</h2>

      {!practiceActive && (
        <div className="practice-controls">
          <button onClick={openInputModal} className="primary-button">
            Add Custom Text
          </button>

          <div className="practice-options">
            <label>
              <input
                type="checkbox"
                checked={isShuffled}
                onChange={() => setIsShuffled(!isShuffled)}
              />
              Shuffle Units
            </label>
            <label>
              <input
                type="checkbox"
                checked={isInterleaved}
                onChange={() => setIsInterleaved(!isInterleaved)}
              />
              Interleave Units
            </label>
          </div>
        </div>
      )}

      {practiceActive && (
        <div className="practice-area">
          <div className="current-unit">
            <h3>{units[currentUnitIndex]}</h3>
            <p>
              Unit {currentUnitIndex + 1} of {units.length}
              {completedCycles > 0 && ` (Cycles completed: ${completedCycles})`}
            </p>
          </div>

          <div className="input-area">
            <input
              ref={inputRef}
              type="text"
              value={userInput}
              onChange={handleInputChange}
              placeholder="Type the unit shown above..."
              autoFocus
            />
          </div>

          <button onClick={resetPractice} className="secondary-button">
            Reset Practice
          </button>
        </div>
      )}

      {/* Cycle notification - moved outside of practice area */}
      {showCycleNotification && (
        <div className="cycle-notification">
          Cycle completed! Starting again...
        </div>
      )}

      {!practiceActive && units.length > 0 && (
        <div className="practice-complete">
          <p>{units.length > 0 ? "Practice complete!" : ""}</p>
          <button
            onClick={() => {
              setCurrentUnitIndex(0);
              setUserInput("");
              setPracticeActive(true);
            }}
            className="primary-button"
          >
            Restart Practice
          </button>
        </div>
      )}

      {/* Modal for text input */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Enter Custom Practice Text</h3>
            <p>Enter space-separated words or letters for practice:</p>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="e.g., 'th he in an on' or 'a b c d e'"
              rows={5}
              autoFocus
            />
            <div className="modal-buttons">
              <button
                onClick={() => setShowModal(false)}
                className="secondary-button"
              >
                Cancel
              </button>
              <button onClick={processText} className="primary-button">
                Start Practice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
