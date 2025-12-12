from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from backend.db.models.base import Base


class Club(Base):
    __tablename__ = "clubs"
    __table_args__ = (
        UniqueConstraint("name", "school", name="uq_clubs_name_school"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    sort_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    name: Mapped[str] = mapped_column(Text, nullable=False)
    school: Mapped[str] = mapped_column(Text, nullable=False)

    province: Mapped[str] = mapped_column(Text, nullable=False)
    city: Mapped[str] = mapped_column(Text, nullable=False, default="")

    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)

    logo: Mapped[str] = mapped_column(Text, nullable=False, default="")
    short_description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")

    tags_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    external_links_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")

    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    source_submission_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    verified_by: Mapped[str | None] = mapped_column(Text, nullable=True)
