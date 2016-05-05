# __NAME__

## Installation Guide
1. Clone project to specific folder
2. Run command `npm install`
3. Run command `git submodule init`
4. Run command `git submodule update`
5. Install grunt `npm i grunt-cli -g`
6. Run command `grunt build`
7. Install forever `npm i forever -g`
8. Run `forever app.js`

## Preset initial data
Run command `node app.js --resetDataentry=1`
This command drops all existing collections and creates new ones, that exists
in 'dataentry' folder.
After reset users, please run `bin/hash_passwords.js`
