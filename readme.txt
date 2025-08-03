--------------------------------------------
Scraper Hospimedia - Instructions Simples
--------------------------------------------

Ce projet a été préparé pour extraire automatiquement les contacts clés 
(par exemple : directeur, DSI, DAF) de chaque établissement sur 
https://nominations.hospimedia.fr

Objectif : obtenir un fichier CSV avec les principaux contacts à envoyer 
à l’agent LinkedIn/email.

---


ÉTAPES POUR LANCER LE SCRAPER :

1. Prérequis :
   - Node.js doit être installé (https://nodejs.org)
   - Avoir un compte actif sur https://nominations.hospimedia.fr
   - Navigateur Chrome avec l’extension "EditThisCookie" installée

2. Exporter les cookies de session :
   - Se connecter sur Hospimedia avec le compte pro
   - Ouvrir l’extension EditThisCookie
   - Exporter les cookies du domaine "nominations.hospimedia.fr"
   - Sauvegarder le fichier dans ce dossier sous le nom : cookies.json

3. Lancer le scraper :
   - Ouvrir un terminal dans ce dossier
   - Taper :
       npm install
       node scraper.js

   - Le script va visiter les établissements, récupérer les 2-3 
     profils principaux et générer un fichier :
       leads.csv

---

OPTION : Exécuter via Docker

   - Taper :
       docker build -t hospimedia-scraper .
       docker run --rm -v ${PWD}:/app hospimedia-scraper

---

Fichier généré : leads.csv
Utilisable directement pour prospection.

---

En cas de besoin :
- Vérifier que cookies.json est bien au bon format (voir README.md)
- Refaire une connexion manuelle sur le site si session expirée

Fait pour usage interne uniquement. Conforme RGPD (B2B).
