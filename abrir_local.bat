@echo off
REM Sobe servidor HTTP local na pasta site/ e abre o comparar.html no browser.
REM Uso: duplo clique. Fecha com Ctrl+C ou fechando esta janela.

cd /d "%~dp0"
echo Servidor local em http://localhost:8000/
echo Abrindo comparar.html no navegador padrao...
echo (Fecha esta janela quando terminar)
echo.
start "" http://localhost:8000/comparar.html
python -m http.server 8000
