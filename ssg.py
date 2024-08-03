import json
import os

# Load site metadata from a JSON file
def load_metadata(file_path):
    with open(file_path, 'r') as file:
        return json.load(file)

# Generate HTML for personal info
def generate_personal_info_html(info):
    current_positions_html = ''
    for position in info['current_positions']:
        collaborators_html = ', '.join([f'<a href="{c["link"]}">{c["name"]}</a>' for c in position.get('collaborators', [])])
        current_positions_html += f'''
        <li><p>{position["role"]} at <a href="{position["link"]}">{position["organization"]}</a>, {position.get("location", "")}</p></li>
        <li><p>working with {collaborators_html},</p></li>
        '''

    previous_positions_html = ''
    for position in info['previous_positions']:
        collaborators_html = ', '.join([f'<a href="{c["link"]}">{c["name"]}</a>' for c in position.get('collaborators', [])])
        previous_positions_html += f'''
        <li><p>{position["role"]} at <a href="{position["link"]}">{position["organization"]}</a>,</p></li>
        <li><p>collaborated with {collaborators_html}.</p></li>
        '''

    links_html = ' '.join([f'<a href="{link["url"]}" class="black-buttons"><i class="{link["icon"]} fa-3x"></i></a>' for link in info['links']])

    personal_info_html = f'''
    <header>
        <h1>{info["name"]}</h1>
        <img id="profile_pic" src="{info["profile_image"]}">
        <br>
        <b>is currently</b>
        <ul>{current_positions_html}</ul>
        <ul>
            <li><p>who applies computer vision and computer graphics techniques to computational imaging/sensing research,</p></li>
        </ul>
        <b>and previously</b>
        <ul>{previous_positions_html}</ul>
        <div style="text-align: center;">
            <p style="margin: auto;"><a href="{info["cv_url"]}">CV</a>, as of {info["cv_date"]}.</p>
        </div>
        <br>
        <div class="d-flex flex-column centered-buttons">
            <div class="p2">{links_html}</div>
        </div>
    </header>
    '''
    return personal_info_html

# Generate HTML for publications
def generate_publications_html(publications):
    publications_html = ''
    for paper in publications:
        authors_html = ', '.join([f'<a href="{author["url"]}">{author["name"]}</a>' if author["url"] else f'<b>{author["name"]}</b>' for author in paper['authors']])
        additional_links = ' '.join([
            f'<a href="{paper.get("website_url", "#")}">[Website]</a>' if paper.get("website_url") else '',
            f'<a href="{paper.get("press_url", "#")}">[Press]</a>' if paper.get("press_url") else '',
            f'<a href="{paper.get("twitter_url", "#")}">[Twitter]</a>' if paper.get("twitter_url") else '',
            f'<a href="{paper.get("code_url", "#")}">[Code]</a>' if paper.get("code_url") else '',
            f'<a href="{paper.get("video_url", "#")}">[Video]</a>' if paper.get("video_url") else ''
        ])

        # Apply the background style if the paper is marked as important
        background_style = 'background-color:#ffffd0;' if paper.get("important", False) else ''

        publications_html += f'''
        <div class="row align-items-center" style="margin-top: 20px; margin-bottom: 20px;">
            <div class="col-md-3">
                <img class="img-fluid" src="{paper["image"]}" style="border:0px solid black" alt="">
            </div>
            <div class="col-md-9" style="{background_style}">
                <span class="text-group">
                    <b>{paper["title"]}</b>
                </span>
                <span class="text-group">
                    {authors_html}
                </span>
                <span class="text-group">
                    {paper["conference"]}
                </span>
                <br>
                <a href="{paper["paper_url"]}" target="_blank">[Paper]</a> {additional_links}
            </div>
        </div>
        '''
    return publications_html

# Generate HTML for projects
def generate_projects_html(projects):
    projects_html = ''
    for project in projects:
        projects_html += f'''
        <div class="p2" style="padding-bottom: 10px; padding-top: 10px; text-align: center;">
            <img src="{project["image"]}" width="75%" style="display: block; margin: 0 auto;">
            <a class="btn btn-secondary w-2" href="{project["url"]}" style="margin-top: 20px; margin-bottom: 20px;">{project["title"]}</a>
        </div>
        '''
    return projects_html

# Generate HTML for the inspiration section
def generate_inspiration_html(inspiration):
    inspiration_html = ' '.join([f'<a href="{inspire["link"]}">{inspire["name"]}</a>' for inspire in inspiration])
    return f'<p>Site design inspired by {inspiration_html}.</p>'

# Generate the full HTML page
def generate_html_page(data):
    html_header = '''
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Kevin W. Zhang</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap" rel="stylesheet">
        <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.1.1/css/bootstrap.min.css" integrity="sha384-WskhaSGFgHYWDcbwN70/dfYBj47jz9qbsMId/iRN3ewGhXQFZCSftd1LZCfmhktB" crossorigin="anonymous">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/jpswalsh/academicons@1/css/academicons.min.css">
        <link rel="stylesheet" type="text/css" href="mystyle.css">
        <link rel="icon" type="image/x-icon" href="favicon.ico">
    </head>
    <body>
        <div class="vertical-center">
    '''

    personal_info_html = generate_personal_info_html(data['personal_info'])
    publications_html = generate_publications_html(data['publications'])
    projects_html = generate_projects_html(data['projects'])
    inspiration_html = generate_inspiration_html(data['inspiration'])

    html_body = f'''
    {personal_info_html}
    <section>
        <div class="subsect">
            <h4><b>Publications</b> (* indicates equal contribution)</h4>
            <hr>
            {publications_html}
        </div>
        <br>
        <div class="subsect">
            <h4><b>Side Projects</b></h4>
            <hr>
            <p>I also enjoy building small web apps to visualize algorithmic ideas. The source code for these projects is on my Github.</p>
            {projects_html}
            <br>
            {inspiration_html}
        </div>
    </section>
    '''

    html_footer = '''
        </div>
        </div>
        <script src="https://code.jquery.com/jquery-3.3.1.slim.min.js" integrity="sha384-q8i/X+965DzO0rT7abK41JStQIAqVgRVzpbzo5smXKp4YfRvH+8abtTE1Pi6jizo" crossorigin="anonymous"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.14.3/umd/popper.min.js" integrity="sha384-ZMP7rVo3mIykV+2+9J3UJ46jBk0WLaUAdn689aCwoqbBJiSnjAK/l8WvCWPIPm49" crossorigin="anonymous"></script>
        <script src="https://stackpath.bootstrapcdn.com/bootstrap/4.1.1/js/bootstrap.min.js" integrity="sha384-smHYKdLADwkXOn1EmN1qk/HfnUcbVRZyYmZ4qpPea6sjB/pTJ0euyQp0Mk8ck+5T" crossorigin="anonymous"></script>
    </body>
    </html>
    '''

    return html_header + html_body + html_footer

# Main function to generate the HTML file
def main():
    metadata_file = 'site_data.json'
    output_file = 'index.html'

    data = load_metadata(metadata_file)
    html_content = generate_html_page(data)

    with open(output_file, 'w') as file:
        file.write(html_content)

    print(f"HTML page generated: {output_file}")

if __name__ == '__main__':
    main()
