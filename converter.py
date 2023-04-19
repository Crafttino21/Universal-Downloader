# Your syntax is very blocky so I cleaned it up a little bit

import ctypes
import os
import time

import requests
from pytube import YouTube


def Mbox(title, text, style):
	return ctypes.windll.user32.MessageBoxW(0, text, title, style)


# Mbox('Your title', 'Your text', 1)



# Clears the console


Mbox('MultiDownloader', 'OS MultiDownloader by WeepingAngel | Version: 1.2.1 (Patched)', 1)

blue = os.system("color b")
red = os.system("color C")
green = os.system("color a")
pink = os.system("color D")


def menu():
	print(banner)
	os.system("color D")
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

                        * Open Sorce Multi Downloader by CraftModzZ aka. WeepingAngel *
                Discord: _WeepingAngel_ VI#6666 | GitHub: https://www.github.com/crafttino21


'''
menu()
option = int(input("Choose your Converter > "))

while option != 0:
	if option == 1:
		try:
			link = input("Enter your YouTube Link (mp4): ")
			yt = YouTube(link)
			y = yt.title.title()
			print("Video Title: " + y)
			z = yt.author.title()
			print("Uploader: " + z)
			ys = yt.streams.get_highest_resolution()
			ys.download()
			Mbox('MultiDownloader by WeepingAngel', 'Download Sussccessfully and Finished!', 1)
			et = input("Do you wanna Download another video? (Y/N) > ")
			if et == "Y":
				os.system("cls")
				menu()
				option = int(input("Choose your Converter > "))
			else:
				Mbox('MultiDownloader by WeepingAngel', 'Thanks for Using This Tool :)', 1)
				exit()
		except:
			print("[ERROR] Cant Download the Video or invalid link!")
			time.sleep(5)
			exit()
	elif option == 2:
		try:
			web = input("Paste your Image: ")
			r = requests.get(web)

			print(r.content)
			with open("output.png", "wb") as f:
				f.write(r.content)
				Mbox('MultiDownloader', 'Download Complete!', 1)
				print(green + "Download Complete!!")
		except:
			print("[ERROR] Cant Convert!!")
	if option == 3:
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
		print("Invalid format!")

	print()
	menu()
	option = int(input("Choose your Converter > "))
