sinclude ../Makefile.include
sinclude ../../.env

PROJECT=packager
PYTHON_FUNCTION=omics-quilt-packager65D35863-wubVTD9lrGM8
BUILD_DIR = ../../build
ZIP_FILE = $(BUILD_DIR)/$(PROJECT).zip
ZIP_DIR = $(BUILD_DIR)/package
SRC_DIR = $(PROJECT)
LAMBDA_BUCKET = $(WRITE_BUCKET)


.PHONY: all clean lint install test watch

all: install test

clean:
	rm -rf .pytest_cache build

install:
	poetry install
	poetry run mypy --install-types

test: lint
	poetry run pytest

watch:
	poetry run ptw --now .

lint: install
	poetry run mypy packager
	poetry run black .

requirements.txt: pyproject.toml
	poetry self add poetry-plugin-export
	poetry export -f requirements.txt --output requirements.txt

$(ZIP_DIR): requirements.txt $(SRC_DIR)/*
	mkdir -p $(ZIP_DIR)
	pip install -r requirements.txt -t $(ZIP_DIR) --upgrade
	cp -r $(SRC_DIR)/* $(ZIP_DIR)/

$(ZIP_FILE): $(ZIP_DIR)
	zip -r $(ZIP_FILE)  $(ZIP_DIR)

upload: $(ZIP_FILE)
	echo $(LAMBDA_BUCKET)
	aws s3 cp $(ZIP_FILE) s3://$(LAMBDA_BUCKET)/$(PROJECT).zip
	aws lambda update-function-code --function-name $(PYTHON_FUNCTION) --s3-bucket $(LAMBDA_BUCKET) --s3-key $(PROJECT).zip