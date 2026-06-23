import json
import tempfile
import unittest
from pathlib import Path

from tools.charts import generate_chart_data


class ChartDataTest(unittest.TestCase):
    def test_generate_chart_data_writes_interactive_attitude_series(self):
        parsed_log = {
            "duration_s": 4,
            "raw_sample": {
                "vehicle_attitude": {
                    "data_subset": {
                        "q[0]": [1, 1, 1, 1],
                        "q[1]": [0, 0.01, 0.02, 0.03],
                        "q[2]": [0, 0.02, 0.03, 0.04],
                        "q[3]": [0, 0.03, 0.04, 0.05],
                    }
                }
            },
        }

        with tempfile.TemporaryDirectory() as tmp:
            output_path = generate_chart_data(parsed_log, {}, tmp)
            data = json.loads(Path(output_path).read_text(encoding="utf-8"))

        self.assertEqual(data["version"], 1)
        attitude = next(chart for chart in data["charts"] if chart["id"] == "attitude")
        self.assertEqual(attitude["title"], "姿态角")
        self.assertEqual([series["name"] for series in attitude["series"]], ["Roll", "Pitch", "Yaw"])
        self.assertEqual(len(attitude["series"][0]["points"]), 4)


if __name__ == "__main__":
    unittest.main()
