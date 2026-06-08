import json
import re
from typing import Optional

from langchain_core.tools import tool
from pydantic import BaseModel, Field, validator

from .student_tool import global_db
from .models import ScoreFilter, ScoreResponse


class ScoreInput(BaseModel):
    student_code: str = Field(description="The student code to get scores for")
    semester: Optional[str] = Field(None,
                                    description="Filter scores by semester in format ki1_2024_2025, k2_2024_2025, etc.")
    subject_id: Optional[int] = Field(None, description="Filter scores by subject ID")
    subject_name: Optional[str] = Field(None, description="Filter scores by subject name, e.g. 'Toan cao cap', 'Lap trinh Python'. Prefer this over subject_id when the user asks by course name.")

    @validator('semester')
    def validate_semester_format(cls, value):
        if value is None:
            return value

        pattern = r"^(ki|k)[1-2]-\d{4}-\d{4}$"
        if not re.match(pattern, value):
            raise ValueError("Semester must be in format ki1-2024-2025, k2-2024-2025, etc.")
        return value


@tool("get_student_scores", args_schema=ScoreInput,
      description=("Get KMA student scores from the database. "
                    "Useful for retrieving scores for a specific student. "
                    "The student code must be provided. Optionally filter by semester in format ki1-2024-2025 or k2-2024-2025. "
                    "When the user asks for a course/subject, pass subject_name from the user's text instead of inventing a subject_id.")
                    )
async def get_student_scores(student_code: str, semester: Optional[str] = None,
                             subject_id: Optional[int] = None,
                             subject_name: Optional[str] = None) -> str:
    """
    Get student scores from the database.

    Args:
        student_code: The student code to get scores for
        semester: Optional semester to filter scores by in format ki1_2024_2025, k2_2024_2025, etc.
        subject_id: Optional subject ID to filter scores by

    Returns:
        A JSON string containing the scores and any additional information
    """

    try:
        # Validate semester format if provided
        if semester:
            print("Validating semester format...", semester)
            pattern = r"^(ki|k)[1-2]-\d{4}-\d{4}$"
            if not re.match(pattern, semester):
                return json.dumps({"scores": [],
                                   "message": f"Invalid semester format. Must be in format ki1_2024_2025, k2_2024_2025, etc."})

        # Create filter
        filter = ScoreFilter(
            student_code=student_code,
            semester=semester,
            subject_id=subject_id,
            subject_name=subject_name
        )

        # Get scores
        scores = await global_db.db.get_scores(filter)

        if not scores:
            return json.dumps({"scores": [], "message": f"No scores found for student {student_code}" + (
                f" in semester {semester}" if semester else "")})

        # Convert to serializable format
        scores_data = [score.model_dump() for score in scores]

        response = ScoreResponse(scores=scores, message=f"Found {len(scores)} scores for student {student_code}" + (
            f" in semester {semester}" if semester else ""))

        return json.dumps(response.model_dump())

    except Exception as e:
        return json.dumps({"scores": [], "message": f"Error retrieving scores: {str(e)}"})
    finally:
        await global_db.close()
