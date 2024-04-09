'use strict';

const form = document.querySelector('.form');
const formEdit = document.querySelector('.form__edit');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const inputTypeEdit = document.querySelector('.form__input--type--edit');
const inputDistanceEdit = document.querySelector('.form__input--distance--edit');
const inputDurationEdit = document.querySelector('.form__input--duration--edit');
const inputCadenceEdit = document.querySelector('.form__input--cadence--edit');
const inputElevationEdit = document.querySelector('.form__input--elevation--edit');

class Workout {
    date = new Date();
    id = (Date.now() + '').slice(-10);

    constructor(coords, distance, duration) {
        this.coords = coords; // [lat, long]
        this.distance = distance; // in km
        this.duration = duration; // in min
    }

    _setDescription() {
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

        this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${months[this.date.getMonth()]} ${this.date.getDate()}`;
    }
}

class Running extends Workout {
    type = 'running';

    constructor(coords, distance, duration, cadence) {
        super(coords, distance, duration);
        this.cadence = cadence;
        this.calcPage();
        this._setDescription();
    }

    calcPage() {
        // min/km
        this.pace = this.duration / this.distance;

        return this.pace;
    }
}

class Cycling extends Workout {
    type = 'cycling';

    constructor(coords, distance, duration, elevationGain) {
        super(coords, distance, duration);
        this.elevationGain = elevationGain;
        this.calcSpeed();
        this._setDescription();
    }

    calcSpeed() {
        // km/h
        this.speed = this.distance / (this.duration / 60);

        return this.speed;
    }
}
// -------------------------------------------------------
// APP ARCHITECTURE
class App {
    #map;
    #mapZoomLevel = 13;
    #mapEvent; //private instance properties
    #workouts = [];
    #workoutId;
    #workoutMarkers = [];

    constructor() {
        // Get user's position
        this._getPosition();

        // Get data from local storage
        this._getLocalStorage();

        // Attach event handlers
        form.addEventListener('submit', this._newWorkout.bind(this));
        inputType.addEventListener('change', this._toggleElevationField);
        inputTypeEdit.addEventListener('change', this._toggleElevationFieldEdit);
        containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));
        containerWorkouts.addEventListener('click', this._editWorkout.bind(this));
        containerWorkouts.addEventListener('click', this._deleteWorkout.bind(this));
        formEdit.addEventListener('submit', this._submitEdittedWorkout.bind(this));
    }

    _getPosition() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(this._loadMap.bind(this), function () {
                alert('Could not get you position');
            })
        }
    }

    _loadMap(position) {
        const { latitude } = position.coords;
        const { longitude } = position.coords;

        const coords = [latitude, longitude];

        this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

        L.tileLayer('https://tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(this.#map);

        // Handling clicks on map
        this.#map.on('click', this._showForm.bind(this));

        this.#workouts.forEach(workout => {
            this._renderWorkoutMarker(workout);
        });
    }

    _showForm(mapE) {
        if (!formEdit.classList.contains('hidden')) {
            this._hideEditForm();
        }

        this.#mapEvent = mapE;
        form.classList.remove('hidden');
        inputDistance.focus();
    }

    _showEditForm() {
        formEdit.classList.remove('hidden');
        inputDistanceEdit.focus();
        // formEdit.scrollIntoView();
        formEdit.scrollIntoView({ behavior: "smooth" });
    }

    _hideForm() {
        // Empty inputs
        inputCadence.value = inputDistance.value = inputDuration.value = inputElevation.value = '';
        form.style.display = 'none';
        form.classList.add('hidden');
        setTimeout(() => form.style.display = 'grid', 1000);
    }

    _hideEditForm() {
        // Empty inputs
        inputCadenceEdit.value = inputDistanceEdit.value = inputDurationEdit.value = inputElevationEdit.value = '';
        formEdit.style.display = 'none';
        formEdit.classList.add('hidden');
        setTimeout(() => formEdit.style.display = 'grid', 1000);
    }

    _toggleElevationField() {
        inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
        inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
    }

    _toggleElevationFieldEdit() {
        inputElevationEdit.closest('.form__row--edit').classList.toggle('form__row--hidden');
        inputCadenceEdit.closest('.form__row--edit').classList.toggle('form__row--hidden');
    }

    _newWorkout(e) {
        const validInputs = (...inputs) => inputs.every(inp => Number.isFinite(inp));
        const allPositive = (...inputs) => inputs.every(inp => inp > 0);

        e.preventDefault();

        if (!formEdit.classList.contains('hidden')) {
            formEdit.classList.add('hidden');
        }

        // Get data from form
        const type = inputType.value;
        const distance = +inputDistance.value;
        const duration = +inputDuration.value;
        const { lat, lng } = this.#mapEvent.latlng;
        let workout;

        // If workout running, create running object
        if (type === 'running') {
            const cadence = +inputCadence.value
            // Check if data is valid
            if (!validInputs(distance, duration, cadence) || !allPositive(distance, duration, cadence))
                return alert('Inputs have to be positive numbers!');

            workout = new Running([lat, lng], distance, duration, cadence);
        }

        //If workout cycling, create cycling object
        if (type === 'cycling') {
            const elevation = +inputElevation.value;

            if (!validInputs(distance, duration, elevation) || !allPositive(distance, duration))
                return alert('Inputs have to be positive numbers!');

            workout = new Cycling([lat, lng], distance, duration, elevation);

        }

        // Add new object to workout array
        this.#workouts.push(workout);

        // Render workout on map as marker
        this._renderWorkoutMarker(workout);

        // Render workout on list
        this._renderWorkout(workout)

        // Hide form + Clear input fields
        this._hideForm();

        // Set local storage to all workouts
        this._setLocalStorage();
    }

    _setNewDescription(workout) {
        workout.date = new Date(workout.date);
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

        workout.description = `${workout.type[0].toUpperCase()}${workout.type.slice(1)} on ${months[workout.date.getMonth()]} ${workout.date.getDate()}`;
    }

    _renderWorkoutMarker(workout, editing = false) {
        let marker = L.marker(workout.coords).addTo(this.#map);

        marker.bindPopup(
            L.popup({
                maxWidth: 250,
                minWidth: 100,
                autoClose: false,
                closeOnClick: false,
                className: `${workout.type}-popup`
            })
        ).setPopupContent(`${workout.type === 'running' ? '🏃‍♂️' : '🚴🏻‍♂️'} ${workout.description}`).openPopup();

        this.#workoutMarkers.push(marker);

        if (editing) {
            const markerIndex = this.#workoutMarkers.findIndex(marker => {
                return (
                    marker._latlng.lat === workout.coords[0] &&
                    marker._latlng.lng === workout.coords[1]
                );
            });

            // Deleting the old marker from UI (from the map)
            this.#map.removeLayer(this.#workoutMarkers[markerIndex]);

            // Replacing the old marker with the new one in the #workoutMarkers array
            this.#workoutMarkers.splice(markerIndex, 1, marker);
        }
    }

    _removeWorkoutMarker(workout, workoutToDelete) {
        const workoutToRemoveIndex = this.#workoutMarkers.findIndex(function (workoutMarker) {
            if (workoutMarker._latlng.lat === workout.coords[0] && workoutMarker._latlng.lng === workout.coords[1]) {
                return workoutMarker;
            }
        });

        // Remove marker form the Map and from the array of markers
        this.#map.removeLayer(this.#workoutMarkers[workoutToRemoveIndex]);
        this.#workoutMarkers.splice(workoutToRemoveIndex, 1);
        if (workoutToDelete) {
            workoutToDelete.remove();
        }
    }

    _renderWorkout(workout) {
        let html =
            `<li class="workout workout--${workout.type}" id="${workout.id}" data-id="${workout.id}">
                <h2 class="workout__title">${workout.description}</h2>
                <div class="workout__details">
                    <span class="workout__icon">${workout.type === 'running' ? '🏃‍♂️' : '🚴🏻‍♂️'}</span>
                    <span class="workout__value--distance">${workout.distance}</span>
                    <span class="workout__unit">km</span>
                </div>
                <div class="workout__details">
                    <span class="workout__icon">⏱</span>
                    <span class="workout__value--duration">${workout.duration}</span>
                    <span class="workout__unit">min</span>
                </div>`;

        if (workout.type === 'running') {
            html +=
                `<div class="workout__details">
                    <span class="workout__icon">⚡️</span>
                    <span class="workout__value--pace">${workout.pace.toFixed(1)}</span>
                    <span class="workout__unit">min/km</span>
                </div>
                <div class="workout__details">
                    <span class="workout__icon">🦶🏼</span>
                    <span class="workout__value--cadence">${workout.cadence}</span>
                    <span class="workout__unit">spm</span>
                </div>
                <div class="btns">
                    <button class="edit__btn" data-id="${workout.id}"> Edit Workout </button>
                    <button class="delete__btn" data-id="${workout.id}"> Delete Workout </button>
                </div>
            </li>`
        }

        if (workout.type === 'cycling') {
            html +=
                `<div class="workout__details">
                    <span class="workout__icon">⚡️</span>
                    <span class="workout__value--speed">${workout.speed.toFixed(1)}</span>
                    <span class="workout__unit">km/h</span>
                </div>
                <div class="workout__details">
                    <span class="workout__icon">⛰</span>
                    <span class="workout__value--elevation">${workout.elevationGain}</span>
                    <span class="workout__unit">m</span>
                </div>
                <div class="btns">
                    <button class="edit__btn" data-id="${workout.id}"> Edit Workout </button>
                    <button class="delete__btn" data-id="${workout.id}"> Delete Workout </button>
                </div>
            </li>`;
        }

        form.insertAdjacentHTML('afterend', html);
    }

    _submitEdittedWorkout(e) {
        e.preventDefault();
        const closestWorkout = document.getElementById(this.#workoutId);
        let distance, duration, cadence, elevation;
        const workout = this.#workouts.find(work => work.id === this.#workoutId);
        const workoutIndex = this.#workouts.findIndex(work => work.id === this.#workoutId);


        workout.distance = inputDistanceEdit.value;
        workout.duration = inputDurationEdit.value;
        distance = workout.distance;
        duration = workout.duration;


        if (inputTypeEdit.value === 'running') {
            workout.elevation = '';
            workout.cadence = inputCadenceEdit.value;
            cadence = inputCadenceEdit.value;
        }

        if (inputTypeEdit.value === 'cycling') {
            workout.cadence = '';
            workout.type = inputTypeEdit.value;
            workout.elevation = inputElevationEdit.value;
            elevation = inputElevationEdit.value;
        }

        closestWorkout.querySelector(".workout__value--distance").textContent = distance;
        closestWorkout.querySelector(".workout__value--duration").textContent = duration;


        if (cadence) {
            workout.cadence = cadence;
            workout.pace = duration / distance;
            workout.type = 'running';

            this._setNewDescription(this.#workouts[workoutIndex]);
            this.#workouts[workoutIndex] = workout;
            this._renderWorkout(workout);
            this._renderWorkoutMarker(workout, true);
            closestWorkout.remove();
        }

        if (elevation) {
            workout.elevationGain = elevation;
            workout.speed = distance / (duration / 60);
            workout.type = 'cycling';

            this._setNewDescription(this.#workouts[workoutIndex]);
            this.#workouts[workoutIndex] = workout;
            this._renderWorkout(workout);
            this._renderWorkoutMarker(workout, true);
            closestWorkout.remove();
        }

        this._hideEditForm();

        this._setLocalStorage();
    }

    _editWorkout(event) {
        const editBtnEl = event.target.closest('.edit__btn');

        if (!editBtnEl) return;

        this.#workoutId = editBtnEl.dataset.id;

        const workout = this.#workouts.find(work => work.id === this.#workoutId);

        if (!workout) return;

        if (!form.classList.contains('hidden')) {
            this._hideForm();
        }

        this._showEditForm();
        inputDistanceEdit.value = workout.distance;
        inputDurationEdit.value = workout.duration;

        if (workout.type === "running") {
            if (inputTypeEdit.value !== workout.type) {
                inputTypeEdit.value = workout.type;
            }
            inputCadenceEdit.value = workout.cadence;
        }

        if (workout.type === "cycling") {
            if (inputTypeEdit.value !== workout.type) {
                inputTypeEdit.value = workout.type;
            }
            this._toggleElevationFieldEdit();
            inputElevationEdit.value = workout.elevationGain;
        }

    }

    _moveToPopup(event) {
        const workoutEl = event.target.closest('.workout');

        if (!workoutEl) return;

        const workout = this.#workouts.find(work => work.id === workoutEl.dataset.id);

        this.#map.setView(workout.coords, this.#mapZoomLevel, {
            animate: true,
            pan: {
                duration: 1
            }
        })
    }

    _setLocalStorage() { // use only for small amounts of data!
        localStorage.setItem('workouts', JSON.stringify(this.#workouts));
    }

    _getLocalStorage() {
        const data = JSON.parse(localStorage.getItem('workouts'));

        if (!data) return;

        this.#workouts = data;

        this.#workouts.forEach(workout => {
            this._renderWorkout(workout);
        });
    }

    _deleteWorkout(event) {
        const deleteBtn = event.target.closest('.delete__btn');
        let workoutToDelete, workout;

        if (deleteBtn) {
            workoutToDelete = document.getElementById(deleteBtn.dataset.id);
            workout = this.#workouts.find(work => work.id === deleteBtn.dataset.id);
        }

        if (!workout) return;

        this._removeWorkoutMarker(workout, workoutToDelete);

        const index = this.#workouts.findIndex(work => work.id === workout.id);

        // Remove workout from the workouts array and sets the local storage again
        this.#workouts.splice(index, 1);
        this._setLocalStorage();
    }

    reset() {
        localStorage.removeItem('workouts');
        location.reload(); // reloads the application after emptying the workouts
    }
}

const app = new App();