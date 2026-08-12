# WordSpark — English Vocabulary Trainer

## About the project

WordSpark is a cheerful, responsive vocabulary trainer that runs entirely in the browser. It is designed as a beginner-friendly vanilla JavaScript project and includes a ready-to-use Animals set with English–Russian vocabulary.

## Features

- Create, edit, and delete custom vocabulary sets
- Choose English → Russian, Russian → English, or a random direction
- Save sets, difficult words, learned words, and session statistics automatically
- Practice only words that need more work
- Responsive, keyboard-friendly interface with clear focus styles
- No account, server, package manager, or build step required

## Training modes

1. **Flashcards** — flip each card, then choose “I know” or “I don't know.”
2. **Multiple Choice** — select the correct answer from shuffled options.
3. **Write the Word** — type the answer with one extra attempt when needed.

A difficult word is removed from the practice list after two consecutive correct answers.

## Technologies

- Semantic HTML5
- Modern responsive CSS
- Vanilla JavaScript
- Browser `localStorage`

## How to run locally

Download or clone the project and open `index.html` in a modern browser. No installation is needed. For normal use, avoid private browsing because browsers may clear private-session storage.

## Project structure

```text
WordSpark/
├── index.html   # Semantic page shell, dialog, and app entry point
├── style.css    # Responsive layout, visual design, and animations
├── script.js    # App state, screens, training logic, and storage
├── assets/      # Project illustrations, including the Sparky mascot
└── README.md    # Project documentation
```

## How data is stored

WordSpark serializes vocabulary sets and progress into the browser's `localStorage` under the key `wordspark-data-v1`. Data stays on the device and is not uploaded anywhere. Clearing site data will remove saved sets and reset the demo content.

## Publish with GitHub Pages

1. Create a GitHub repository and add these four files at its root.
2. Push or upload the files to the repository's default branch.
3. Open **Settings → Pages** in the GitHub repository.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select the default branch and the `/ (root)` folder, then click **Save**.
6. After deployment finishes, open the URL shown by GitHub Pages.

All links are relative, so the app works both on a project Pages URL and when `index.html` is opened directly.

## Future improvements

- Import and export vocabulary sets
- Optional pronunciation audio
- More detailed progress charts
- Spaced-repetition scheduling
- Custom themes and additional interface languages
