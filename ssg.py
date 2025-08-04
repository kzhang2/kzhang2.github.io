import json
import os

# Load site metadata from a JSON file
def load_metadata(file_path):
    with open(file_path, 'r') as file:
        return json.load(file)

# Generate HTML for personal info
def generate_personal_info_html(info):
    links_html = ' '.join([f'<a href="{link["url"]}" class="black-buttons"><i class="{link["icon"]} fa-2x"></i></a>' for link in info['links']])

    personal_info_html = f'''
    <header>
        <div class="row align-items-center">
            <div class="col-md-4 text-center">
                <img id="profile_pic" src="{info["profile_image"]}">
            </div>
            <div class="col-md-8">
                <h1>{info["name"]}</h1>
                <span class="text-group">
                    {info["bio"]}
                </span>
                <div style="margin-top: 10px;">
                    <div class="p2">{links_html} <a href="{info["cv_url"]}" class="black-buttons"><i class="ai ai-cv fa-2x"></i></a></div>
                </div>
            </div>
        </div>
    </header>
    '''
    return personal_info_html

# Helper function to highlight "Oral" in conference name
def highlight_oral(conference_text):
    if "(Oral" in conference_text:
        return conference_text.replace("(Oral, ", "(<b style='color: red;'>Oral</b>, ")
    return conference_text

# Generate HTML for publications with featured papers first and others in a dropdown
def generate_publications_html(publications):
    # Separate important/featured publications from others
    featured_papers = [paper for paper in publications if paper.get("important", False)]
    other_papers = [paper for paper in publications if not paper.get("important", False)]
    
    # Generate HTML for featured publications
    featured_html = '''
    <h5 style="text-align: left;"><b>Select Publications</b></h5>
    <div class="card card-body" style="border: none; padding: 0; text-align: left;">
    '''
    for paper in featured_papers:
        authors_html = ', '.join([f'<a href="{author["url"]}">{author["name"]}</a>' if author["url"] else f'<b>{author["name"]}</b>' for author in paper['authors']])
        additional_links = ' '.join([
            f'<a href="{paper.get("website_url", "#")}">[Website]</a>' if paper.get("website_url") else '',
            f'<a href="{paper.get("press_url", "#")}">[Press]</a>' if paper.get("press_url") else '',
            f'<a href="{paper.get("twitter_url", "#")}">[Twitter]</a>' if paper.get("twitter_url") else '',
            f'<a href="{paper.get("code_url", "#")}">[Code]</a>' if paper.get("code_url") else '',
            f'<a href="{paper.get("video_url", "#")}">[Video]</a>' if paper.get("video_url") else ''
        ])

        featured_html += f'''
        <div class="row align-items-center publication-row">
            <div class="col-md-3">
                <img class="img-fluid publication-image" src="{paper["image"]}" alt="">
            </div>
            <div class="col-md-9 content-column">
                <span class="text-group">
                    <b>{paper["title"]}</b>
                </span>
                <br>
                <span class="text-group">
                    {authors_html}
                </span>
                <br>
                <span class="text-group">
                    {highlight_oral(paper["conference"])}
                </span>
                <br>
                <a href="{paper["paper_url"]}" target="_blank">[Paper]</a> {additional_links}
            </div>
        </div>
        '''
    
    featured_html += '''
    </div>
    '''
    
    # Generate HTML for other publications in a dropdown
    other_html = ''
    for paper in other_papers:
        authors_html = ', '.join([f'<a href="{author["url"]}">{author["name"]}</a>' if author["url"] else f'<b>{author["name"]}</b>' for author in paper['authors']])
        additional_links = ' '.join([
            f'<a href="{paper.get("website_url", "#")}">[Website]</a>' if paper.get("website_url") else '',
            f'<a href="{paper.get("press_url", "#")}">[Press]</a>' if paper.get("press_url") else '',
            f'<a href="{paper.get("twitter_url", "#")}">[Twitter]</a>' if paper.get("twitter_url") else '',
            f'<a href="{paper.get("code_url", "#")}">[Code]</a>' if paper.get("code_url") else '',
            f'<a href="{paper.get("video_url", "#")}">[Video]</a>' if paper.get("video_url") else ''
        ])

        other_html += f'''
        <div class="row align-items-center publication-row">
            <div class="col-md-3">
                <img class="img-fluid publication-image" src="{paper["image"]}" alt="">
            </div>
            <div class="col-md-9 content-column">
                <span class="text-group">
                    <b>{paper["title"]}</b>
                </span>
                <br>
                <span class="text-group">
                    {authors_html}
                </span>
                <br>
                <span class="text-group">
                    {highlight_oral(paper["conference"])}
                </span>
                <br>
                <a href="{paper["paper_url"]}" target="_blank">[Paper]</a> {additional_links}
            </div>
        </div>
        '''
    
    # Combine featured and other publications with a dropdown for others
    dropdown_html = f'''
    {featured_html}
    
    <div class="dropdown-container" style="margin-top: 30px; margin-bottom: 20px;">
        <button class="btn btn-outline-secondary" type="button" id="otherPublicationsButton" data-toggle="collapse" data-target="#otherPublications" aria-expanded="false" aria-controls="otherPublications">
            Show Additional Publications
        </button>
        <div class="collapse" id="otherPublications">
            <div class="card card-body" style="border: none; padding: 0; text-align: left;">
                <h5 style="text-align: left;"><b>Additional Publications</b></h5>
                {other_html}
            </div>
        </div>
    </div>
    '''
    
    return dropdown_html

# Generate HTML for projects
def generate_projects_html(projects):
    # Generate HTML for projects with dropdown using grid layout
    projects_html = '''
    <div class="dropdown-container" style="margin-top: 20px; margin-bottom: 20px;">
        <button class="btn btn-outline-secondary" type="button" id="projectsButton" data-toggle="collapse" data-target="#sideProjects" aria-expanded="false" aria-controls="sideProjects">
            Show Side Projects
        </button>
        <div class="collapse" id="sideProjects">
            <div class="card card-body" style="border: none; padding: 20px 0 0 0;">
                <div class="row">
    '''
    
    for project in projects:
        projects_html += f'''
                    <div class="col-sm-12 col-md-6 col-lg-3 mb-4">
                        <div class="text-center">
                            <img src="{project["image"]}" class="img-fluid project-image">
                            <div>
                                <a class="btn btn-secondary btn-sm" href="{project["url"]}">{project["title"]}</a>
                            </div>
                        </div>
                    </div>
        '''
    
    projects_html += '''
                </div>
            </div>
        </div>
    </div>
    '''
    
    return projects_html

def generate_articles_html(articles):
    if not articles:
        return ''
        
    articles_html = '<h4><b>Articles</b></h4>'
    for article in articles:
        # Handle optional image
        image_html = ''
        if article.get("image"):
            image_html = f'''
            <div class="col-md-3">
                <img class="img-fluid article-image" src="{article["image"]}" alt="">
            </div>
            '''
            col_width = "col-md-9"
        else:
            col_width = "col-md-12"

        articles_html += f'''
        <div class="row align-items-center publication-row">
            {image_html}
            <div class="{col_width} content-column">
                <span class="text-group">
                    <b>{article["title"]}</b>
                </span>
                <br>
                <span class="text-group">
                    <small>{article.get("date", "")}</small>
                </span>
                <br>
                <span class="text-group">
                    {article["description"]}
                </span>
                <br>
                <a href="{article["url"]}" target="_blank">[View Article]</a>
            </div>
        </div>
        '''
    return articles_html

def generate_updates_html(updates):
    if not updates:
        return ''
        
    updates_html = '<h4><b>Updates</b></h4>'
    for update in updates:
        # Convert date to YYYY-MM format
        date_str = update.get("date", "")
        if date_str:
            try:
                # Parse the date and format as YYYY-MM
                from datetime import datetime
                date_obj = datetime.strptime(date_str, "%Y-%m-%d")
                formatted_date = date_obj.strftime("%Y-%m")
            except:
                formatted_date = date_str
        else:
            formatted_date = ""
            
        updates_html += f'''
        <div class="row no-gutters align-items-start updates-row">
            <div class="col-md-2 content-column">
                <span class="text-group">
                    <small>{formatted_date}</small>
                </span>
            </div>
            <div class="col-md-10 content-column">
                <span class="text-group">
                    {update["description"]}
                </span>
                {f'<br><a href="{update["url"]}" target="_blank">[Read More]</a>' if update.get("url") else ''}
            </div>
        </div>
        '''
    return updates_html

# Generate HTML for the inspiration section
def generate_inspiration_html(inspiration):
    inspiration_html = ', '.join([f'<a href="{inspire["link"]}">{inspire["name"]}</a>' for inspire in inspiration])
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
    updates_html = generate_updates_html(data.get('updates', []))
    publications_html = generate_publications_html(data['publications'])
    articles_html = generate_articles_html(data.get('articles', []))
    projects_html = generate_projects_html(data['projects'])
    inspiration_html = generate_inspiration_html(data['inspiration'])

    html_body = f'''
    {personal_info_html}
    {updates_html and f'<section>{updates_html}</section>' or ''}
    <section>
        <h4><b>Publications</b> (* indicates equal contribution)</h4>
        {publications_html}
    </section>
    {articles_html and f'<section>{articles_html}</section>' or ''}
    <section>
        <h4><b>Side Projects</b></h4>
        <span class="text-group">I also enjoy building small web apps to visualize algorithmic ideas. The source code for these projects is on my Github.</span>
        {projects_html}
        <br>
        {inspiration_html}
    </section>
    '''

    html_footer = '''
        </div>
        </div>
        <script src="https://code.jquery.com/jquery-3.3.1.slim.min.js" integrity="sha384-q8i/X+965DzO0rT7abK41JStQIAqVgRVzpbzo5smXKp4YfRvH+8abtTE1Pi6jizo" crossorigin="anonymous"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.14.3/umd/popper.min.js" integrity="sha384-ZMP7rVo3mIykV+2+9J3UJ46jBk0WLaUAdn689aCwoqbBJiSnjAK/l8WvCWPIPm49" crossorigin="anonymous"></script>
        <script src="https://stackpath.bootstrapcdn.com/bootstrap/4.1.1/js/bootstrap.min.js" integrity="sha384-smHYKdLADwkXOn1EmN1qk/HfnUcbVRZyYmZ4qpPea6sjB/pTJ0euyQp0Mk8ck+5T" crossorigin="anonymous"></script>
        <script>
            // Add event listener to change button text when dropdowns are toggled
            $(document).ready(function() {
                // Initialize button text
                $('#otherPublicationsButton').text('Show Additional Publications');
                $('#projectsButton').text('Show Side Projects');
                
                $('#otherPublicationsButton').click(function() {
                    if($(this).attr('aria-expanded') === 'false') {
                        $(this).text('Hide Additional Publications');
                    } else {
                        $(this).text('Show Additional Publications');
                    }
                });
                
                $('#projectsButton').click(function() {
                    if($(this).attr('aria-expanded') === 'false') {
                        $(this).text('Hide Side Projects');
                    } else {
                        $(this).text('Show Side Projects');
                    }
                });
            });
        </script>
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