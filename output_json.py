import csv
import json
import os

import pandas as pd


def questions_to_json():
    """
    Converts the questions to json format so that it can be handled by app.
    """
    # Path to the CSV file
    csv_path = "questions.csv"

    # Path to output JSON file
    output_dir = "src"
    output_path = os.path.join(output_dir, "questions.json")

    # Ensure the output directory exists
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    # Read CSV and convert to list of dictionaries
    questions = []

    try:
        with open(csv_path, "r", encoding="utf-8") as csvfile:
            reader = csv.DictReader(csvfile)
            for num, row in enumerate(reader):
                # Extract only the required fields
                question = {
                    "pergunta": row["pergunta"],
                    "type": row["type"],
                    "theme": row["theme"],
                    "short": True if int(row["short"]) == 1 else False,
                    "index": num,
                    "multiplier": int(row["multiplier"]),
                }
                questions.append(question)

        # Write to JSON file
        with open(output_path, "w", encoding="utf-8") as jsonfile:
            json.dump(questions, jsonfile, ensure_ascii=False, indent=2)

        print(f"Successfully converted CSV to JSON. Output saved to {output_path}")
        print(f"Total questions processed: {len(questions)}")

    except Exception as e:
        print(f"Error occurred: {str(e)}")


def tuple_to_css_position(x, y):
    """
    Convert coordinates from (-1, 1) range to CSS position.

    Parameters:
    x, y: Coordinates in (-1, 1) range where:
        (-1, 1) is top-left
        (1, 1) is top-right
        (-1, -1) is bottom-left
        (1, -1) is bottom-right

    Returns:
    Dictionary with 'left' and 'top' as percentages
    """
    # Offset to center logo
    offset = 3
    # Map x from (-1, 1) to (0%, 100%)
    left_percent = ((x + 1) / 2) * 100
    left_percent = left_percent - offset

    # Map y from (1, -1) to (0%, 100%)
    # Note: We invert y because in CSS, top: 0% is the top of the container
    # and top: 100% is the bottom, while in our coordinate system,
    # y=1 is top and y=-1 is bottom
    top_percent = ((1 - y) / 2) * 100
    top_percent = top_percent - offset

    return {"left": f"{left_percent}%", "top": f"{top_percent}%"}


def calculate_compass_scores(party: str):
    """Calculates Economic, Social, and Political scores (-1 to 1) using multipliers."""
    scores = {"economic": 0.0, "social": 0.0, "political": 0.0}

    df = pd.read_csv("questions.csv")
    social_q = df[df["type"] == "social"]
    economic_q = df[df["type"] == "económico"]
    political_q = df[df["type"] == "política"]

    entity_answers = df[party]
    multipliers = df["multiplier"]

    axis_definitions = {
        "economic": economic_q,
        "social": social_q,
        "political": political_q,
    }
    for axis_name, question_texts in axis_definitions.items():
        valid_answers = entity_answers[question_texts.index]
        relevant_multipliers = multipliers[valid_answers.index]

        num_answered = len(valid_answers)
        weighted_score_sum = (valid_answers * relevant_multipliers).sum()
        normalized_score = weighted_score_sum / (num_answered * 2.0)
        scores[axis_name] = max(-1.0, min(1.0, normalized_score))

    position = tuple_to_css_position(scores["economic"], scores["social"])
    return {**scores, **position}


def make_party_answers():
    """"""
    # Path to the CSV file
    csv_path = "questions.csv"

    # Path to output JSON file
    output_dir = "src"
    output_path = os.path.join(output_dir, "party_answers.json")

    # Ensure the output directory exists
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    # columns to exclude
    non_numeric_columns = ["pergunta", "type", "theme", "short", "multiplier"]

    # Dictionary to store numeric data
    numeric_data = {}

    try:
        with open(csv_path, "r", encoding="utf-8") as csvfile:
            reader = csv.DictReader(csvfile)

            # Get all columns from the header
            columns = [
                col for col in reader.fieldnames if col not in non_numeric_columns
            ]

            # Initialize empty dicts for all numeric columns
            for party in columns:
                numeric_data[party] = {}

            # Process each row
            for index, row in enumerate(reader):
                for party in columns:
                    try:
                        # Try to convert to integer, handle "NaN" as null
                        value = row[party]
                        if value == "NaN":
                            numeric_data[party][index] = None
                        else:
                            numeric_data[party][index] = int(value)
                    except (ValueError, TypeError):
                        # If conversion fails, keep as is
                        numeric_data[party][index] = row[party]

        # Write to JSON file
        with open(output_path, "w", encoding="utf-8") as jsonfile:
            json.dump(numeric_data, jsonfile, ensure_ascii=False)

    except Exception as e:
        print(f"Error occurred: {str(e)}")


def convert_party_info():
    """
    Convert the party info including the economic and social dimension.
    """

    # Path to the CSV file
    csv_path = "party_info.csv"

    # Path to output JSON file
    output_dir = "src"
    output_path = os.path.join(output_dir, "party_info.json")

    # Ensure the output directory exists
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    # Dictionary to store party data
    party_data = {}

    try:
        with open(csv_path, "r", encoding="utf-8") as csvfile:
            reader = csv.DictReader(csvfile)

            # Process each row
            for row in reader:
                party_key = row["party_key"]
                score = calculate_compass_scores(party_key)
                party_data[party_key] = {
                    "key": party_key,
                    "abbreviation": row["abbreviation"],
                    "fullname": row["fullname"],
                    "leaning": row["leaning"],
                    "programme": row["programme"],
                    "website": row["website"],
                    "blurb": row["party_blurb"],
                    **score,
                }

        # Write to JSON file
        with open(output_path, "w", encoding="utf-8") as jsonfile:
            json.dump(party_data, jsonfile, ensure_ascii=False, indent=2)

        print(
            f"Successfully converted party info to JSON. Output saved to {output_path}"
        )
        print(f"Total parties processed: {len(party_data)}")

    except Exception as e:
        print(f"Error occurred: {str(e)}")
        raise


if __name__ == "__main__":
    questions_to_json()
    make_party_answers()
    print("Successfully converted numeric columns to JSON.")
    convert_party_info()
