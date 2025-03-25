import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartData,
} from "chart.js";
import { useEffect, useRef } from "react";
import { LetterProgress } from "./DynamicPractice";
import "./StatsDashboard.css";

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface StatsDashboardProps {
  activeLetters: LetterProgress[];
  sessionAttempts: number;
  sessionCorrect: number;
}

export const StatsDashboard = ({
  activeLetters,
  sessionAttempts,
  sessionCorrect,
}: StatsDashboardProps) => {
  // Create refs for the chart containers
  const accuracyChartRef = useRef<HTMLDivElement>(null);
  const attemptsChartRef = useRef<HTMLDivElement>(null);

  // Set up resize observer to handle responsive layout changes
  useEffect(() => {
    // Create a ResizeObserver to watch for container size changes
    const resizeObserver = new ResizeObserver(() => {
      // Force chart redraw by dispatching a resize event
      window.dispatchEvent(new Event("resize"));
    });

    // Watch both chart containers
    if (accuracyChartRef.current) {
      resizeObserver.observe(accuracyChartRef.current);
    }
    if (attemptsChartRef.current) {
      resizeObserver.observe(attemptsChartRef.current);
    }

    // Clean up
    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Prepare accuracy data
  const accuracyData: ChartData<"bar"> = {
    labels: activeLetters.map((l) => l.char),
    datasets: [
      {
        label: "Letter Accuracy (%)",
        data: activeLetters.map((l) => Math.round(l.accuracy * 100)),
        backgroundColor: "rgba(75, 192, 192, 0.5)",
        borderColor: "rgba(75, 192, 192, 1)",
        borderWidth: 1,
      },
    ],
  };

  // Prepare attempts data
  const attemptsData: ChartData<"bar"> = {
    labels: activeLetters.map((l) => l.char),
    datasets: [
      {
        label: "Number of Attempts",
        data: activeLetters.map((l) => l.attempts),
        backgroundColor: "rgba(54, 162, 235, 0.5)",
        borderColor: "rgba(54, 162, 235, 1)",
        borderWidth: 1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    resizeDelay: 100,
    plugins: {
      legend: {
        position: "top" as const,
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          font: {
            size: 10,
          },
        },
      },
      x: {
        ticks: {
          font: {
            size: 9,
          },
          autoSkip: true,
          maxRotation: 45,
          minRotation: 45,
        },
      },
    },
  };

  return (
    <div className="stats-dashboard">
      <div className="stats-header">
        <h2>Practice Statistics</h2>
        <div className="session-stats">
          <div className="stat-item">
            <label>Session Attempts</label>
            <span>{sessionAttempts}</span>
          </div>
          <div className="stat-item">
            <label>Session Accuracy</label>
            <span>
              {sessionAttempts > 0
                ? Math.round((sessionCorrect / sessionAttempts) * 100)
                : 0}
              %
            </span>
          </div>
          <div className="stat-item">
            <label>Active Letters</label>
            <span>{activeLetters.length}</span>
          </div>
        </div>
      </div>

      <div className="charts-wrapper">
        <div className="chart-container">
          <h3>Letter Accuracy</h3>
          <div className="chart" ref={accuracyChartRef}>
            <Bar data={accuracyData} options={chartOptions} />
          </div>
        </div>

        <div className="chart-container">
          <h3>Attempts per Letter</h3>
          <div className="chart" ref={attemptsChartRef}>
            <Bar data={attemptsData} options={chartOptions} />
          </div>
        </div>
      </div>
    </div>
  );
};
