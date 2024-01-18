This Python script performs the following tasks:

1. It searches a specified directory for subdirectories containing a partial string in their names.
2. For each matching subdirectory, it looks for a 'reports' subdirectory within it.
3. If found, it processes the 'report.csv' file inside the 'reports' directory.
4. It extracts the domain from the 'report.csv' file and creates summary files for different columns in the report.
5. It also counts the total number of unique URLs in the report and saves it to a separate file.

To install and execute the Python script:

1. Ensure you have Python installed on your Mac.

2. Open your terminal.

3. Navigate to the directory where you have saved the Python script.

4. You can execute the script with the following command:

```bash
python script_name.py -d /path/to/directory -p partial_string
```

Replace `script_name.py` with the actual name of your Python script. You can provide the `-d` option to specify the directory to scan (default is the current directory), and the `-p` option to specify the partial string to search for (default is today's date).

For example:

```bash
python find_score.py -d /path/to/some_directory -p my_string
```
