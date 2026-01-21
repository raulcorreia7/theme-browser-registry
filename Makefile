PYTHON ?= python3
OUTPUT ?= themes.json
SCHEMA ?= themes.schema.json

.PHONY: help fetch fetch-no-token validate all

help:
	@echo "nvim-theme-registry"
	@echo "  make fetch         Fetch themes (uses GITHUB_TOKEN if set)"
	@echo "  make fetch-no-token Fetch themes without a token"
	@echo "  make validate      Validate themes.json against schema"
	@echo "  make all           Fetch and validate"

fetch:
	@tmp=$$(mktemp); \
	$(PYTHON) scripts/fetch_themes.py --output $$tmp && \
	$(MAKE) validate OUTPUT=$$tmp && \
	mv $$tmp $(OUTPUT)

fetch-no-token:
	@tmp=$$(mktemp); \
	GITHUB_TOKEN= $(PYTHON) scripts/fetch_themes.py --output $$tmp && \
	$(MAKE) validate OUTPUT=$$tmp && \
	mv $$tmp $(OUTPUT)

validate:
	@if command -v check-jsonschema >/dev/null 2>&1; then \
		check-jsonschema --schemafile $(SCHEMA) $(OUTPUT); \
	elif $(PYTHON) -m jsonschema >/dev/null 2>&1; then \
		$(PYTHON) -m jsonschema -i $(OUTPUT) $(SCHEMA); \
	else \
		echo "Missing jsonschema CLI. Install 'check-jsonschema' or 'python3 -m jsonschema'."; \
		exit 1; \
	fi

all: fetch validate
