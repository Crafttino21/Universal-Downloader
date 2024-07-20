# Universal-Downloader
A Python-based converter for some stuff, I wanna add some new functions later. The program can download pictures from Google and YouTube Videos Everything is Ad-Free, I dont like paid or Ad-Infected stuff.

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/X8X7MF230)

MD5 of exe: C2FA4B9C472C3521DF80D64958AFA0FD (Not Updated Yet!)

**New to version 1.4**
* added --install-ffmpeg argument and installer (requires winget)
* replaces pyTube with yt_dlp
* Removed test Features


**New to version 1.3.1 (Patch)**
* Added 2 new YouTube functions to replace PyTube in 1.4 

# Read before use!
The YouTube to mp4 feature requires ffmpeg!  
Make sure you installed "Windows Packet Manager" (winget)  
Open a CMD window and type:  
`converter.exe --install-ffmpeg`  
if everything is working correct, now everthing works :)  


**New to version 1.3**
* Mayor Bug fixes
* Crash-on-Download Fix
* fix for a shitty error message by the requests libary which is Enoing but have no Consequents for the code
P.S look Below for the feature of MultiDownloader!!


**New to version 1.2.2 (Patched)**
* Used while True instead of while option != 0 to simplify the loop.
* Used input() instead of int(input()) to handle non-integer input gracefully.
* Used option.lower() to convert the input option to lowercase and simplify the if statements.
* Removed the exit() calls in the try-except blocks and used continue instead to keep the loop running.
* Added better exit() mechanic with sys.exit() which passing a 1 means an error occured.
* Added a prompt for the destination directory in option 3.
* Moved the menu() call outside the function to prevent an infinite recursion loop.

**Version 1.2 Functions**
 - Download YouTube videos as MP4
 - Download pictures from any site and Google with the picture source
 - Download YouTube MP3

**Planed feature for MultiDownloader**
* Add a Torrent function
* add Tiktok Options
* add Reddit options
* add Spotify options
* give evrything a GUi outside of the Command line (Maybe)
  Spaical thank's to Cozi to help me Fixing bugs and make the code cleaner :)

## How to install
**Prerequisites**  
* [Python](https://www.python.org/downloads) 3.9/3.10/3.11
* Windows 10+
 
### Linux:
`sudo apt update`  
`sudo apt-get install git` <== Skip this if you have it already  
`git clone https://github.com/Crafttino21/Universal-Downloader.git`  
   
### Windows
Download the official version [here](https://github.com/Crafttino21/Universal-Downloader/releases)  
Or download and extract the `.zip` of main brach [here](https://github.com/Crafttino21/Universal-Downloader/archive/refs/heads/main.zip)  
     
**Once Installed**  
Open a console in the directory and type `pip install -r requirements.txt`  
To run the program simply type `python converter.py`  
 

THIS TOOL IS FOR PRIVATE USE ONLY DON'T USE IT TOO BREAK COPYRIGHT LAWS OR FEDERAL LAWS!
