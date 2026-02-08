PYTHON ?= python3
OUTPUT ?= themes.json
SCHEMA ?= themes.schema.json

.PHONY: help validate all index-once index-loop index-publish index-docker-up index-docker-once

help:
	@echo "theme-browser-registry"
	@echo "  make validate      Validate themes.json against schema"
	@echo "  make index-once    Run ORM indexer once"
	@echo "  make index-loop    Run ORM indexer continuously"
	@echo "  make index-publish Run ORM indexer and publish changed artifacts"
	@echo "  make index-docker-up   Start containerized indexer"
	@echo "  make index-docker-once Run containerized indexer once"
	@echo "  make all           Run index-once and validate"

validate:
	@if command -v check-jsonschema >/dev/null 2>&1; then \
		check-jsonschema --schemafile $(SCHEMA) $(OUTPUT); \
	elif $(PYTHON) -m jsonschema >/dev/null 2>&1; then \
		$(PYTHON) -m jsonschema -i $(OUTPUT) $(SCHEMA); \
	else \
		echo "Missing jsonschema CLI. Install 'check-jsonschema' or 'python3 -m jsonschema'."; \
		exit 1; \
	fi

all: index-once validate

index-once:
	@$(PYTHON) scripts/indexer.py run-once --config indexer.config.json

index-loop:
	@$(PYTHON) scripts/indexer.py run-loop --config indexer.config.json

index-publish:
	@$(PYTHON) scripts/indexer.py run-once-publish --config indexer.config.json

index-docker-up:
	@docker compose -f docker-compose.indexer.yml up -d --build

index-docker-once:
	@docker compose -f docker-compose.indexer.yml run --rm indexer python scripts/indexer.py run-once --config indexer.config.json
