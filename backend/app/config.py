"""Runtime configuration, read from environment variables (see .env.example)."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # When true, every Gemini / Maps call is replaced by deterministic fixtures,
    # so the whole app runs locally with no Google Cloud credentials.
    mock_mode: bool = True

    # Google Cloud
    gcp_project: str = ""
    gcp_location: str = "us-central1"
    gcs_bucket: str = ""  # uploads go here in live mode (gs://<bucket>/uploads/...)

    # Storage backend: "memory" (default, seeded with demo data) or "firestore"
    store: str = "memory"
    firestore_database: str = "(default)"

    # Models. Confirm the latest IDs in Vertex AI Model Garden on Day 0 and set them in .env.
    model_reasoning: str = "gemini-2.5-pro"  # video understanding, negotiation, design
    model_fast: str = "gemini-2.5-flash"  # translation, short summaries, grounding
    model_image: str = "gemini-2.5-flash-image"  # design renders
    model_embedding: str = "gemini-embedding-2-preview"
    embedding_dim: int = 768  # reduced via Matryoshka; must match the Firestore vector index

    # Google Maps Platform (Places + Geocoding), server-side key
    maps_api_key: str = ""

    # Demo / judge mode pacing (seconds between visible steps)
    demo_step_delay: float = 0.6

    # Matching radius for destinations and buyers
    search_radius_km: float = 15.0

    # CORS origin for the web app
    cors_origins: str = "*"


@lru_cache
def get_settings() -> Settings:
    return Settings()
