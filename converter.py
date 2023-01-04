# Your syntax is very blocky so I cleaned it up a little bit

import ctypes
import os
import time

import requests
from colorama import Fore
from pytube import YouTube


def Mbox(title, text, style):
	return ctypes.windll.user32.MessageBoxW(0, text, title, style)


# Mbox('Your title', 'Your text', 1)


txt = "Open SOrce YouTube Converter by CraftModzZ"
x = txt.title()
# Clears the console
CC = lambda: os.system('cls' if os.name in ('nt', 'dos') else 'clear')

Mbox('MultiDownloader', 'OS MultiDownloader by WeepingAngel | Version: 1.2', 1)


def menu():
	print(x)
	print(Fore.RED + banner)

	print("[1] YouTube to MP4")
	print()
	print("[2] Image Downloader")
	print()
	print("[3] YouTube to MP3 (New!)")
	print()


banner = '''

███╗   ███╗██╗   ██╗██╗  ████████╗██╗██████╗  ██████╗ ██╗    ██╗███╗   ██╗██╗      ██████╗  █████╗ ██████╗ 
████╗ ████║██║   ██║██║  ╚══██╔══╝██║██╔══██╗██╔═══██╗██║    ██║████╗  ██║██║     ██╔═══██╗██╔══██╗██╔══██╗
██╔████╔██║██║   ██║██║     ██║   ██║██║  ██║██║   ██║██║ █╗ ██║██╔██╗ ██║██║     ██║   ██║███████║██║  ██║
██║╚██╔╝██║██║   ██║██║     ██║   ██║██║  ██║██║   ██║██║███╗██║██║╚██╗██║██║     ██║   ██║██╔══██║██║  ██║
██║ ╚═╝ ██║╚██████╔╝███████╗██║   ██║██████╔╝╚██████╔╝╚███╔███╔╝██║ ╚████║███████╗╚██████╔╝██║  ██║██████╔╝
╚═╝     ╚═╝ ╚═════╝ ╚══════╝╚═╝   ╚═╝╚═════╝  ╚═════╝  ╚══╝╚══╝ ╚═╝  ╚═══╝╚══════╝ ╚═════╝ ╚═╝  ╚═╝╚═════╝ 

                        * Open Sorce Multi Downloader by CraftModzZ *
                Discord: _WeepingAngel_ VI#6666 | GitHub: https://www.github.com/crafttino21


'''
menu()
option = int(input("Choose your Converter > "))

while option != 0:
	if option == 1:
		try:
			CC()
			link = input("Enter YouTube Link (mp4): ")
			yt = YouTube(link)

			y = yt.title.title()
			print(Fore.BLUE + "Video Title: " + y)
			z = yt.author.title()
			print(Fore.BLUE + "Uploader: " + z)
			ys = yt.streams.get_highest_resolution()
			ys.download()
			Mbox('MultiDownloader', 'Download Complete!', 1)
			print(Fore.GREEN + "Download Complete!!")
			time.sleep(5)
			exit()
		except:
			print(Fore.RED + "[ERROR] Cant Download the Video or invalid link!")
			time.sleep(5)
			exit()
	elif option == 2:
		try:
			CC()
			web = input("Paste your Image: ")
			r = requests.get(web)

			print(r.content)
			with open("output.png", "wb") as f:
				f.write(r.content)
				Mbox('MultiDownloader', 'Download Complete!', 1)
				print(Fore.GREEN + "Download Complete!!")
		except:
			print(Fore.RED + "[ERROR] Cant Convert!!")
	if option == 3:
		CC()
		print("YouTube to MP3 (Beta)")
		yt = YouTube(
			str(input("Enter the URL of the video you want to download: \n>> ")))
		video = yt.streams.filter(only_audio=True).first()
		print("Enter the destination (leave blank for current directory)")
		destination = str(input(">> ")) or '.'
		out_file = video.download(output_path=destination)
		base, ext = os.path.splitext(out_file)
		new_file = base + '.mp3'
		os.rename(out_file, new_file)
		print(yt.title + " has been successfully downloaded.")
		Mbox('MultiDownloader', 'Download Successfully!', 1)
		exit()
	else:
		print(Fore.RED + "Invalid format!")

	print()
	menu()
	option = int(input("Choose your Converter > "))
