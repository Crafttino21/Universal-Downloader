from pytube import YouTube
import os
import time
from colorama import Fore
import requests

txt = "Open SOrce YouTube Converter by CraftModzZ"
x = txt.title()

def menu():
    print(x)
    print(Fore.RED + banner)

    print("[1] YouTube to mp4 Downloader")
    print()
    print("[2] Image Downloader")
    print()





banner = '''


 ███▄ ▄███▓ █    ██  ██▓  ▄▄▄█████▓ ██▓   ▓█████▄  ▒█████   █     █░███▄    █  ██▓     ▒█████   ▄▄▄      ▓█████▄ ▓█████  ██▀███  
▓██▒▀█▀ ██▒ ██  ▓██▒▓██▒  ▓  ██▒ ▓▒▓██▒   ▒██▀ ██▌▒██▒  ██▒▓█░ █ ░█░██ ▀█   █ ▓██▒    ▒██▒  ██▒▒████▄    ▒██▀ ██▌▓█   ▀ ▓██ ▒ ██▒
▓██    ▓██░▓██  ▒██░▒██░  ▒ ▓██░ ▒░▒██▒   ░██   █▌▒██░  ██▒▒█░ █ ░█▓██  ▀█ ██▒▒██░    ▒██░  ██▒▒██  ▀█▄  ░██   █▌▒███   ▓██ ░▄█ ▒
▒██    ▒██ ▓▓█  ░██░▒██░  ░ ▓██▓ ░ ░██░   ░▓█▄   ▌▒██   ██░░█░ █ ░█▓██▒  ▐▌██▒▒██░    ▒██   ██░░██▄▄▄▄██ ░▓█▄   ▌▒▓█  ▄ ▒██▀▀█▄  
▒██▒   ░██▒▒▒█████▓ ░██████▒▒██▒ ░ ░██░   ░▒████▓ ░ ████▓▒░░░██▒██▓▒██░   ▓██░░██████▒░ ████▓▒░ ▓█   ▓██▒░▒████▓ ░▒████▒░██▓ ▒██▒
░ ▒░   ░  ░░▒▓▒ ▒ ▒ ░ ▒░▓  ░▒ ░░   ░▓      ▒▒▓  ▒ ░ ▒░▒░▒░ ░ ▓░▒ ▒ ░ ▒░   ▒ ▒ ░ ▒░▓  ░░ ▒░▒░▒░  ▒▒   ▓▒█░ ▒▒▓  ▒ ░░ ▒░ ░░ ▒▓ ░▒▓░
░  ░      ░░░▒░ ░ ░ ░ ░ ▒  ░  ░     ▒ ░    ░ ▒  ▒   ░ ▒ ▒░   ▒ ░ ░ ░ ░░   ░ ▒░░ ░ ▒  ░  ░ ▒ ▒░   ▒   ▒▒ ░ ░ ▒  ▒  ░ ░  ░  ░▒ ░ ▒░
░      ░    ░░░ ░ ░   ░ ░   ░       ▒ ░    ░ ░  ░ ░ ░ ░ ▒    ░   ░    ░   ░ ░   ░ ░   ░ ░ ░ ▒    ░   ▒    ░ ░  ░    ░     ░░   ░ 
       ░      ░         ░  ░        ░        ░        ░ ░      ░            ░     ░  ░    ░ ░        ░  ░   ░       ░  ░   ░     
                                           ░                                                              ░                      
                                                            
                                * Open Sorce YouTube Converter by CraftModzZ *
                        Discord: _WeepingAngel_ VI#6666 | GitHub: https://www.github.com/crafttino21


'''
menu()
option = int(input("Choose your Converter > "))


while option != 0:
    if option == 1:
        try:
            link = input("Enter YouTube Link (mp4): ")
            yt = YouTube(link)

            y = yt.title.title()
            print(Fore.BLUE + "Video Title: " + y)
            z = yt.author.title()
            print(Fore.BLUE + "Uploader: " + z)
            ys = yt.streams.get_highest_resolution()
            ys.download()
            print(Fore.GREEN + "Download Complete!!")
            time.sleep(5)
            exit()
        except:
            print(Fore.RED + "[ERROR] Cant Download the Video or invalid link!")
            time.sleep(5)
            exit()
    elif option == 2:
        try:
            web = input("Paste your Image: ")
            r = requests.get(web)

            print(r.content)
            with open("output.png", "wb") as f:
                f.write(r.content)
                print(Fore.GREEN + "Download Complete!!") 
        except:
            print(Fore.RED + "[ERROR] Cant COnvert!!")
    else:
            print(Fore.RED + "Invalid formart!")

    print()
    menu()
    option = int(input("Choose your Converter > "))












