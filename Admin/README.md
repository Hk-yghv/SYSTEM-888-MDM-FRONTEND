# Note

--> [` first start code please type this code in terminal `]

=>  ` npm install `
=>  ` npm run dev ` preview your project
=>  ` npm run bulid `   finish project use this code and push ` dist folder ` to github
=>  ` npm install react-router-dom ` install route-dom

## Code Encrypt File (` NOTED.houv `)

# Website Open File ( NOTED.houv can open only this website ): https://houvencrypt.vercel.app
# Code Encrypt : p_1@123bk1

---------------------------------------------------------------------------------------------

--> [` About route `]

# This code

import { BrowserRouter, Routes, Route } from "react-router-dom";


<BrowserRouter>
 <Header />
 <Routes>
   <Route>
     <Route path="/" element={<Home />} />
     <Route path="/about" element={<About />} />
   </Route>
 </Routes>
</BrowserRouter>

=>  ` path ` show in route
=>  ` element ` go to some page if you want 
# Example

<Home /> in header if you click home it go to home page and in route it show (https://project/.vercel.app)
<About /> in header if you click about it go to about page and in route it show (https://project/about.vercel.app)

---------------------------------------------------------------------------------------------

--> [` Creat page new `]

=>  Add this ` import namefile from 'location file'; ` in App.jsx

---------------------------------------------------------------------------------------------

--> [` Import style `]

=>  Add this ` import 'location file'; ` in your code jsx

---------------------------------------------------------------------------------------------

--> [` Conect file `]

# Example

=>  In home page have header main footer. But you creat a header file separate from the main and footer and you want to conect with main and footer use ['import Header from 'location file;'] at fist line and [' <Header /> '] in [ "return" ] your file if you want to conect.

---------------------------------------------------------------------------------------------

--> [` Style Link Name and Button `]
=>  { Style } use [` <div style={{width: '100%', heihgt: '100%'}}></div> `]
=>  { Link } use [` import {Link} from 'react-router-dom'; `] and [` <Link to=''></Link> `]
=>  { Name } use [` className `]
=>  { Button } use [` <button onClick={() => window.open = 'https://www.youtube.com'}>Go to youtube</button> `]

# If want input image in project website first make folder name [` assets `]

# If use BrowserRouter first make file name vercel.json and input this code

{
    "rewrites": [
        { "source": "/(.*)", "destination": "/" }
    ]
}

# Make file .gitignore

# Write this code in file .gitignore

# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

node_modules
dist
dist-ssr
*.local

# Editor directories and files
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?

# For push github

# If make new website project in github

git init
git add README.md    # If use for framwork
git commit -m "first commit"
git branch -M main
git remote add origin ( link github )
git push -u origin main

# If push old project 

git remote add origin ( https:// .... )
git branch -M main
git push -u origin main

# If want chang remote 

git remote remove origin
git remote add origin https://github.com/username/repo.git
git push -u origin main

# If want see your remote

git remote -v



# Update vesion

- npm version patch => patch → 1.0.0 → 1.0.1
- npm version minor => minor → 1.0.0 → 1.1.0
- npm version major => major → 1.0.0 → 2.0.0

# Chang name project

- ` npm pkg set name="..." `

# Update data in package-lock.json

- ` npm install --package-lock-only `