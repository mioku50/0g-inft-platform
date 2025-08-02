-- Database Schema for Fine-tuning System Rebuild
-- Supports model versioning and consent tracking

-- Model versions table
CREATE TABLE IF NOT EXISTS model_versions (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER NOT NULL,
    model_root_hash VARCHAR(66) UNIQUE NOT NULL, -- bytes32 hex string with 0x prefix
    status VARCHAR(20) NOT NULL DEFAULT 'candidate', -- candidate | active | archived
    dataset_root_hash VARCHAR(66) NOT NULL,
    pretrained_hash VARCHAR(66) NOT NULL,
    training_params_hash VARCHAR(66) NOT NULL,
    metrics_json TEXT, -- JSON string with training metrics
    log_root VARCHAR(66), -- Optional log storage root
    provider_address VARCHAR(42) NOT NULL, -- Ethereum address
    task_id VARCHAR(255) NOT NULL,
    tx_hash_created VARCHAR(66), -- Transaction hash for TaskCreated event
    tx_hash_delivered VARCHAR(66), -- Transaction hash for ModelDelivered event
    tx_hash_activated VARCHAR(66), -- Transaction hash for ModelActivated event (if active)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    delivered_at TIMESTAMP,
    activated_at TIMESTAMP,
    archived_at TIMESTAMP
);

-- Consents table (optional off-chain signatures)
CREATE TABLE IF NOT EXISTS consents (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER NOT NULL,
    user_address VARCHAR(42) NOT NULL, -- Ethereum address
    consent_type VARCHAR(20) NOT NULL, -- fineTune | activate
    payload_json TEXT NOT NULL, -- JSON payload that was signed
    signature VARCHAR(132) NOT NULL, -- EIP-712 signature
    signature_hash VARCHAR(66) NOT NULL, -- Hash of the signature for on-chain reference
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Training tasks table (for tracking task lifecycle)
CREATE TABLE IF NOT EXISTS training_tasks (
    id SERIAL PRIMARY KEY,
    task_id VARCHAR(255) UNIQUE NOT NULL,
    agent_id INTEGER NOT NULL,
    user_address VARCHAR(42) NOT NULL,
    provider_address VARCHAR(42) NOT NULL,
    model_id VARCHAR(100) NOT NULL, -- e.g., 'distilbert-base-uncased'
    dataset_root_hash VARCHAR(66) NOT NULL,
    training_params_hash VARCHAR(66) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Init', -- 0G task status
    progress_message TEXT,
    model_root_hash VARCHAR(66), -- Set when delivered
    error_message TEXT,
    tx_hash_attested VARCHAR(66), -- TaskCreated transaction
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    delivered_at TIMESTAMP
);

-- Agent metadata extension for model tracking
CREATE TABLE IF NOT EXISTS agent_model_metadata (
    agent_id INTEGER PRIMARY KEY,
    active_model_root VARCHAR(66), -- Current active model root hash
    active_version_id INTEGER, -- FK to model_versions.id
    has_candidate BOOLEAN DEFAULT FALSE,
    candidate_model_root VARCHAR(66), -- Latest candidate model
    candidate_version_id INTEGER, -- FK to model_versions.id
    total_versions INTEGER DEFAULT 0,
    last_training_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_model_versions_agent_id ON model_versions(agent_id);
CREATE INDEX IF NOT EXISTS idx_model_versions_status ON model_versions(status);
CREATE INDEX IF NOT EXISTS idx_model_versions_model_root_hash ON model_versions(model_root_hash);
CREATE INDEX IF NOT EXISTS idx_training_tasks_agent_id ON training_tasks(agent_id);
CREATE INDEX IF NOT EXISTS idx_training_tasks_task_id ON training_tasks(task_id);
CREATE INDEX IF NOT EXISTS idx_training_tasks_status ON training_tasks(status);
CREATE INDEX IF NOT EXISTS idx_consents_agent_id ON consents(agent_id);
CREATE INDEX IF NOT EXISTS idx_consents_user_address ON consents(user_address);