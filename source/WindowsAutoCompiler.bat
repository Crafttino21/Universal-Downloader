@echo off
title WindowsAutoCompiler by WeepingAngel
color D
echo _- WindowsAutoCompiler by WeepingAngel -_
echo Script: MultiDownloader.py
echo Autor: WeepingAngel
echo Source: GitHub
echo Press enter To Start Compiling!
pause
echo Check Reqirements for Compile!
pip install pyinstaller
pip install -r requirements.txt
echo Check FInished! if you get any errors download Python and PIP!
pause
cls
echo Script: MultiDownloader.py
echo Autor: WeepingAngel
echo Source: GitHub
echo ***************************
echo Start Compiling:
pyinstaller converter.py --onefile --clean
echo Compiling Finished!
pause