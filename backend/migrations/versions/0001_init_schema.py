"""init schema

Revision ID: 0001
Revises: 
Create Date: 2025-12-12

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "clubs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("sort_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("school", sa.Text(), nullable=False),
        sa.Column("province", sa.Text(), nullable=False),
        sa.Column("city", sa.Text(), nullable=False, server_default=""),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("logo", sa.Text(), nullable=False, server_default=""),
        sa.Column("short_description", sa.Text(), nullable=False, server_default=""),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("tags_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("external_links_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("source_submission_id", sa.Integer(), nullable=True),
        sa.Column("verified_by", sa.Text(), nullable=True),
        sa.UniqueConstraint("name", "school", name="uq_clubs_name_school"),
    )

    op.create_index("ix_clubs_province", "clubs", ["province"], unique=False)
    op.create_index("ix_clubs_name", "clubs", ["name"], unique=False)
    op.create_index("ix_clubs_school", "clubs", ["school"], unique=False)

    op.create_table(
        "submissions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("submission_type", sa.Text(), nullable=False),
        sa.Column("editing_club_id", sa.Integer(), nullable=True),
        sa.Column("original_data_json", sa.Text(), nullable=True),
        sa.Column("status", sa.Text(), nullable=False, server_default="pending"),
        sa.Column("submitter_email", sa.Text(), nullable=False),
        sa.Column("data_json", sa.Text(), nullable=False),
        sa.Column("metadata_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("submitted_at", sa.DateTime(), nullable=False),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
        sa.Column("reviewed_by", sa.Text(), nullable=True),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
    )

    op.create_index("ix_submissions_status", "submissions", ["status"], unique=False)

    op.create_table(
        "admin_users",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("username", sa.Text(), nullable=False, unique=True),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("email", sa.Text(), nullable=False, unique=True),
        sa.Column("role", sa.Text(), nullable=False, server_default="super_admin"),
        sa.Column("active", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("last_login", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("admin_users")
    op.drop_index("ix_submissions_status", table_name="submissions")
    op.drop_table("submissions")
    op.drop_index("ix_clubs_school", table_name="clubs")
    op.drop_index("ix_clubs_name", table_name="clubs")
    op.drop_index("ix_clubs_province", table_name="clubs")
    op.drop_table("clubs")
