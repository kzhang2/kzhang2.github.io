import argparse
import json
import shutil
from html import escape
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CONTENT_PATH = ROOT / "content" / "site.json"
STATIC_PATH = ROOT / "static"
ARTICLES_PATH = ROOT / "articles"
DEFAULT_OUTPUT_PATH = ROOT / "_site"

LEGACY_REDIRECTS = {
    "griffiths_prob_2_7_integral": "/articles/griffiths-problem-2-7/",
    "integer_partition_generating_function_forms": "/articles/integer-partition-generating-functions/",
}


def attribute(value):
    """Escape a value before inserting it into an HTML attribute."""
    return escape(str(value), quote=True)

# Load site metadata from a JSON file
def load_metadata(file_path):
    return json.loads(Path(file_path).read_text(encoding="utf-8"))

# Generate HTML for personal info
def generate_personal_info_html(info):
    links_html = ' '.join([
        f'<a href="{attribute(link["url"])}" class="black-buttons"><i class="{attribute(link["icon"])} fa-2x"></i></a>'
        for link in info['links']
    ])

    personal_info_html = f'''
    <header>
        <div class="row align-items-center">
            <div class="col-md-4 text-center">
                <img id="profile_pic" src="{attribute(info["profile_image"])}" alt="Portrait of {attribute(info['name'])}" style="width: {info.get("profile_image_width", 175)}px;">
            </div>
            <div class="col-md-8">
                <h1>{info["name"]}</h1>
                <span class="text-group">
                    {info["bio"]}
                </span>
                <div style="margin-top: 10px;">
                    <div class="p2">{links_html} <a href="{attribute(info["cv_url"])}" class="black-buttons"><i class="ai ai-cv fa-2x"></i></a></div>
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
        authors_html = ', '.join([f'<a href="{attribute(author["url"])}">{author["name"]}</a>' if author["url"] else f'<b>{author["name"]}</b>' for author in paper['authors']])
        additional_links = ' '.join([
            f'<a href="{attribute(paper["website_url"])}">[Website]</a>' if paper.get("website_url") else '',
            f'<a href="{attribute(paper["press_url"])}">[Press]</a>' if paper.get("press_url") else '',
            f'<a href="{attribute(paper["twitter_url"])}">[Twitter]</a>' if paper.get("twitter_url") else '',
            f'<a href="{attribute(paper["code_url"])}">[Code]</a>' if paper.get("code_url") else '',
            f'<a href="{attribute(paper["video_url"])}">[Video]</a>' if paper.get("video_url") else ''
        ])

        featured_html += f'''
        <div class="row align-items-center publication-row">
            <div class="col-md-3">
                <img class="img-fluid publication-image" src="{attribute(paper["image"])}" alt="Preview for {attribute(paper['title'])}" loading="lazy">
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
                <a href="{attribute(paper["paper_url"])}" target="_blank" rel="noopener">[Paper]</a> {additional_links}
            </div>
        </div>
        '''
    
    featured_html += '''
    </div>
    '''
    
    # Generate HTML for other publications in a dropdown
    other_html = ''
    for paper in other_papers:
        authors_html = ', '.join([f'<a href="{attribute(author["url"])}">{author["name"]}</a>' if author["url"] else f'<b>{author["name"]}</b>' for author in paper['authors']])
        additional_links = ' '.join([
            f'<a href="{attribute(paper["website_url"])}">[Website]</a>' if paper.get("website_url") else '',
            f'<a href="{attribute(paper["press_url"])}">[Press]</a>' if paper.get("press_url") else '',
            f'<a href="{attribute(paper["twitter_url"])}">[Twitter]</a>' if paper.get("twitter_url") else '',
            f'<a href="{attribute(paper["code_url"])}">[Code]</a>' if paper.get("code_url") else '',
            f'<a href="{attribute(paper["video_url"])}">[Video]</a>' if paper.get("video_url") else ''
        ])

        other_html += f'''
        <div class="row align-items-center publication-row">
            <div class="col-md-3">
                <img class="img-fluid publication-image" src="{attribute(paper["image"])}" alt="Preview for {attribute(paper['title'])}" loading="lazy">
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
                <a href="{attribute(paper["paper_url"])}" target="_blank" rel="noopener">[Paper]</a> {additional_links}
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
    preamble = projects.get('preamble', '')
    project_items = projects.get('items', [])
    
    # Generate HTML for projects using grid layout
    projects_html = f'''
    <span class="text-group">{preamble}</span>
    <div class="card card-body" style="border: none; padding: 20px 0 0 0;">
        <div class="row">
    '''
    
    for project in project_items:
        if project["image"].endswith((".mp4", ".webm")):
            poster = f' poster="{attribute(project["poster"])}"' if project.get("poster") else ""
            media_html = f'<video src="{attribute(project["image"])}" class="img-fluid project-image" autoplay loop muted playsinline preload="metadata"{poster}></video>'
        else:
            media_html = f'<img src="{attribute(project["image"])}" class="img-fluid project-image" alt="Preview for {attribute(project["title"])}" loading="lazy">'
        projects_html += f'''
            <div class="col-sm-12 col-md-6 col-lg-3 mb-4">
                <div class="text-center">
                    {media_html}
                    <div>
                        <a class="btn btn-secondary btn-sm" href="{attribute(project["url"])}">{project["title"]}</a>
                    </div>
                </div>
            </div>
        '''
    
    projects_html += '''
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
                <img class="img-fluid article-image" src="{attribute(article["image"])}" alt="Preview for {attribute(article['title'])}" loading="lazy">
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
                <a href="{attribute(article["url"])}" target="_blank" rel="noopener">[View Article]</a>
            </div>
        </div>
        '''
    return articles_html

def generate_update_row_html(update):
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

    return f'''
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
            {f'<br><a href="{attribute(update["url"])}" target="_blank" rel="noopener">[Read More]</a>' if update.get("url") else ''}
        </div>
    </div>
    '''

def generate_updates_html(updates, visible_count=3):
    if not updates:
        return ''

    recent_updates = updates[:visible_count]
    older_updates = updates[visible_count:]

    updates_html = '<h4><b>Updates</b></h4>'
    for update in recent_updates:
        updates_html += generate_update_row_html(update)

    if older_updates:
        older_html = ''
        for update in older_updates:
            older_html += generate_update_row_html(update)

        updates_html += f'''
        <div class="dropdown-container" style="margin-top: 10px; margin-bottom: 20px;">
            <button class="btn btn-outline-secondary" type="button" id="otherUpdatesButton" data-toggle="collapse" data-target="#otherUpdates" aria-expanded="false" aria-controls="otherUpdates">
                Show Older Updates
            </button>
            <div class="collapse" id="otherUpdates">
                {older_html}
            </div>
        </div>
        '''

    return updates_html

def generate_reading_list_html(reading_list):
    if not reading_list:
        return ''
    
    preamble = reading_list.get('preamble', '')
    themes = reading_list.get('themes', {})
        
    reading_list_html = f'<h4><b>Reading List</b></h4>'
    if preamble:
        reading_list_html += f'<span class="text-group">{preamble}</span>'
    
    # Generate HTML for themes using grid layout similar to projects
    reading_list_html += f'''
    <div class="card card-body" style="border: none; padding: 20px 0 0 0;">
        <div class="row">
    '''
    
    for theme, books in themes.items():
        books_list = ''.join([f'<div style="text-align: center; margin-bottom: 8px;">{book["title"]}</div>' for book in books])
        reading_list_html += f'''
            <div class="col-sm-12 col-md-6 col-lg-4 mb-4">
                <div class="card h-100" style="border: none; padding: 15px;">
                    <h6 style="text-align: center; margin-bottom: 15px;"><b>{theme}</b></h6>
                    <div style="margin-bottom: 0;">
                        {books_list}
                    </div>
                </div>
            </div>
        '''
    
    reading_list_html += '''
        </div>
    </div>
    '''
    
    return reading_list_html

# Generate HTML for the inspiration section
def generate_inspiration_html(inspiration):
    inspiration_html = ', '.join([f'<a href="{attribute(inspire["link"])}">{inspire["name"]}</a>' for inspire in inspiration])
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
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&amp;display=swap" rel="stylesheet">
        <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.1.1/css/bootstrap.min.css" integrity="sha384-WskhaSGFgHYWDcbwN70/dfYBj47jz9qbsMId/iRN3ewGhXQFZCSftd1LZCfmhktB" crossorigin="anonymous">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/jpswalsh/academicons@1/css/academicons.min.css">
        <link rel="stylesheet" type="text/css" href="static/css/site.css">
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
    reading_list_html = generate_reading_list_html(data.get('reading_list', {}))
    inspiration_html = generate_inspiration_html(data['inspiration'])

    html_body = f'''
    {personal_info_html}
    {updates_html and f'<section>{updates_html}</section>' or ''}
    <section>
        <h4><b>Publications</b> (* indicates equal contribution)</h4>
        {publications_html}
    </section>
    <section>
        <div class="dropdown-container" style="margin-bottom: 20px;">
            <button class="btn btn-outline-secondary" type="button" id="funSectionButton" data-toggle="collapse" data-target="#funSection" aria-expanded="false" aria-controls="funSection">
                Show Fun
            </button>
        </div>
        <div class="collapse" id="funSection">
    {articles_html and f'<section>{articles_html}</section>' or ''}
    <section>
        <h4><b>Side Projects</b></h4>
        {projects_html}
    </section>
    {reading_list_html and f'<section>{reading_list_html}</section>' or ''}
        </div>
    </section>
    <section>
        <br>
        {inspiration_html}
    </section>
    '''

    html_footer = '''
        </div>
        <script src="https://code.jquery.com/jquery-3.3.1.slim.min.js" integrity="sha384-q8i/X+965DzO0rT7abK41JStQIAqVgRVzpbzo5smXKp4YfRvH+8abtTE1Pi6jizo" crossorigin="anonymous"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.14.3/umd/popper.min.js" integrity="sha384-ZMP7rVo3mIykV+2+9J3UJ46jBk0WLaUAdn689aCwoqbBJiSnjAK/l8WvCWPIPm49" crossorigin="anonymous"></script>
        <script src="https://stackpath.bootstrapcdn.com/bootstrap/4.1.1/js/bootstrap.min.js" integrity="sha384-smHYKdLADwkXOn1EmN1qk/HfnUcbVRZyYmZ4qpPea6sjB/pTJ0euyQp0Mk8ck+5T" crossorigin="anonymous"></script>
        <script>
            // Add event listener to change button text when dropdowns are toggled
            $(document).ready(function() {
                // Initialize button text
                $('#otherPublicationsButton').text('Show Additional Publications');
                
                $('#otherPublicationsButton').click(function() {
                    if($(this).attr('aria-expanded') === 'false') {
                        $(this).text('Hide Additional Publications');
                    } else {
                        $(this).text('Show Additional Publications');
                    }
                });

                $('#funSectionButton').text('Show Fun');
                $('#funSectionButton').click(function() {
                    if($(this).attr('aria-expanded') === 'false') {
                        $(this).text('Hide Fun');
                    } else {
                        $(this).text('Show Fun');
                    }
                });

                $('#otherUpdatesButton').text('Show Older Updates');
                $('#otherUpdatesButton').click(function() {
                    if($(this).attr('aria-expanded') === 'false') {
                        $(this).text('Hide Older Updates');
                    } else {
                        $(this).text('Show Older Updates');
                    }
                });
            });
        </script>
    </body>
    </html>
    '''

    return html_header + html_body + html_footer

def generate_article_page(article, body):
    article_url = f'/{article["url"].strip("/")}/'
    description = article.get("meta_description", article["description"])
    return f'''<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="{attribute(description)}">
    <link rel="canonical" href="https://kevinwzhang.com{attribute(article_url)}">
    <title>{escape(article["title"])}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&amp;display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/static/css/article.css">
    <script>
      window.MathJax = {{tex: {{tags: "ams"}}}};
    </script>
    <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
</head>
<body>
    <nav><a href="/">← Kevin W. Zhang</a></nav>
    <main class="content">
{body.strip()}
    </main>
</body>
</html>
'''


def build_articles(articles, output_path):
    for article in articles:
        route = Path(article["url"])
        if route.is_absolute() or len(route.parts) != 2 or route.parts[0] != "articles":
            raise ValueError(f'Invalid article route: {article["url"]}')

        slug = route.parts[1]
        source_dir = ARTICLES_PATH / slug
        content_path = source_dir / "content.html"
        if not content_path.is_file():
            raise FileNotFoundError(f"Missing article content: {content_path}")

        article_output = output_path / "articles" / slug
        shutil.copytree(
            source_dir,
            article_output,
            ignore=shutil.ignore_patterns("content.html", ".DS_Store"),
        )
        (article_output / "index.html").write_text(
            generate_article_page(
                article,
                content_path.read_text(encoding="utf-8"),
            ),
            encoding="utf-8",
        )


# Build the deployable site without exposing generator source files.
def redirect_page(destination):
    return f'''<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="refresh" content="0; url={destination}">
    <link rel="canonical" href="https://kevinwzhang.com{destination}">
    <title>Page moved</title>
</head>
<body>
    <p>This article moved to <a href="{destination}">{destination}</a>.</p>
</body>
</html>
'''


def build(output_path):
    output_path = Path(output_path).resolve()
    if output_path == ROOT or ROOT not in output_path.parents:
        raise ValueError(f"Refusing to replace unsafe output path: {output_path}")

    protected_paths = (
        ARTICLES_PATH,
        CONTENT_PATH.parent,
        ROOT / "media-src",
        ROOT / "scripts",
        STATIC_PATH,
    )
    if any(path == output_path or path in output_path.parents for path in protected_paths):
        raise ValueError(f"Refusing to replace source path: {output_path}")

    if output_path.exists():
        shutil.rmtree(output_path)
    output_path.mkdir(parents=True)

    shutil.copytree(
        STATIC_PATH,
        output_path / "static",
        ignore=shutil.ignore_patterns(".DS_Store"),
    )
    shutil.copy2(ROOT / "CNAME", output_path / "CNAME")
    shutil.copy2(STATIC_PATH / "icons" / "favicon.ico", output_path / "favicon.ico")

    # Preserve the intentionally public standalone video at its existing URL.
    birthday_video = ROOT / "2025_zora_bday.mp4"
    if birthday_video.exists():
        shutil.copy2(birthday_video, output_path / birthday_video.name)

    (output_path / ".nojekyll").write_text("", encoding="utf-8")
    data = load_metadata(CONTENT_PATH)
    (output_path / "index.html").write_text(generate_html_page(data), encoding="utf-8")
    build_articles(data.get("articles", []), output_path)

    for old_path, destination in LEGACY_REDIRECTS.items():
        redirect_dir = output_path / old_path
        redirect_dir.mkdir(parents=True)
        (redirect_dir / "index.html").write_text(
            redirect_page(destination),
            encoding="utf-8",
        )

    print(f"Site generated: {output_path}")


def main():
    parser = argparse.ArgumentParser(description="Build the personal website")
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT_PATH,
        help="output directory (default: %(default)s)",
    )
    args = parser.parse_args()
    build(args.output)

if __name__ == '__main__':
    main()
