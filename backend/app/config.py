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
    gcp_location: str = "us-central1"  # Firestore, Storage and the embedding model (not served globally)
    genai_location: str = "global"  # Gemini generation: the global endpoint routes around busy regions (fewer 429s)
    gcs_bucket: str = ""  # uploads go here in live mode (gs://<bucket>/uploads/...)

    # Storage backend: "memory" (default, seeded with demo data) or "firestore"
    store: str = "memory"
    firestore_database: str = "(default)"

    # Models. Confirm the latest IDs in Vertex AI Model Garden on Day 0 and set them in .env.
    model_reasoning: str = "gemini-2.5-pro"  # video understanding, negotiation, design
    model_fast: str = "gemini-2.5-flash"  # translation, short summaries, grounding
    model_image: str = "gemini-2.5-flash-image"  # design renders
    model_embedding: str = "gemini-embedding-2-preview"
    model_tts: str = "gemini-2.5-flash-tts"  # Listen: reads steps and deal messages aloud
    tts_voice: str = "Kore"
    # How close a listing must be to a standing request to count as a match. Measured with Gemini
    # Embedding 2: right matches scored 0.65-0.78 (Hindi included), wrong ones at most 0.62.
    autopilot_min_score: float = 0.64
    # A live market: sample buyers keep standing requests, and a buyer's agent opens a negotiation as
    # soon as something it wants is listed; the seller then accepts or declines (or lets Autopilot).
    live_market: bool = False
    sample_cities: bool = False  # sample takers and homes in major Asia-Pacific cities (see demo/cities.py)
    embedding_dim: int = 768  # reduced via Matryoshka; must match the Firestore vector index

    # Google Maps Platform (Places + Geocoding), server-side key
    maps_api_key: str = ""

    # Demo / judge mode pacing (seconds between visible steps)
    demo_step_delay: float = 0.6

    # Matching radius for destinations and buyers
    search_radius_km: float = 15.0

    # CORS origin for the web app
    cors_origins: str = "*"

    # Agent2Agent: the seller agent is an A2A service (see app/a2a_seller.py)
    a2a_enabled: bool = True
    a2a_seller_url: str = ""  # empty = call the seller agent in-process; else its base URL
    public_base_url: str = ""  # this API's public URL, written into the Agent Card


@lru_cache
def get_settings() -> Settings:
    return Settings()
