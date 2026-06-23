import unittest
from types import SimpleNamespace

from agent import DroneAgent


def _response(content, finish_reason):
    return SimpleNamespace(
        choices=[
            SimpleNamespace(
                finish_reason=finish_reason,
                message=SimpleNamespace(content=content),
            )
        ]
    )


class ContinuationAgent(DroneAgent):
    def __init__(self):
        self.api_base = "http://example.test/v1"
        self.model = "test-model"
        self.max_tokens = 100
        self.fallback_max_tokens = 50
        self.continuation_max_rounds = 2
        self.calls = []

    def _call_llm(self, system_prompt, user_message, max_tokens):
        self.calls.append((system_prompt, user_message, max_tokens))
        if len(self.calls) == 1:
            return _response("第一段报告，", "length")
        return _response("第二段续写。", "stop")


class LlmContinuationTest(unittest.TestCase):
    def test_generate_report_continues_when_finish_reason_is_length(self):
        agent = ContinuationAgent()

        report = agent._generate_report(
            parsed={"format": "ulg", "firmware": "PX4"},
            metrics={"flight_summary": {"duration_s": 12.3, "flight_mode_changes": 0, "datasets_count": 1, "data_with_content": 1}},
            charts=[],
            findings=[],
            question="检查是否完整",
            params={},
            hardware={},
            metadata=None,
        )

        self.assertEqual(report, "第一段报告，\n\n第二段续写。")
        self.assertEqual(len(agent.calls), 2)
        self.assertIn("继续", agent.calls[1][1])


if __name__ == "__main__":
    unittest.main()
